# Design: Domain Schema First

## Technical Approach

Implement the first business slice as **SQL-first persistence** beside the current NestJS bootstrap shell. PostgreSQL will enforce identity, period, and ledger invariants; NestJS will add only one owner-scoped persistence module plus repositories/services. No auth provider adapter, billing workflow, templates, or controllers are introduced in this slice.

## Architecture Decisions

| Decision | Choice | Alternatives considered | Rationale |
|---|---|---|---|
| PKs, timestamps, soft delete | `BIGINT GENERATED ALWAYS AS IDENTITY` PKs, `created_at/updated_at` on mutable tables, no `deleted_at` in this slice | UUID PKs everywhere; soft delete on all three tables | Internal bigint fits current monolith maturity and avoids extra UUID plumbing. `users` stay canonical, `subscriptions` are historical by append, and `usage_ledger` must never be soft-deleted. |
| Canonical user identity | `users(email, email_normalized GENERATED ALWAYS AS (lower(btrim(email))) STORED, external_subject)` with `UNIQUE(email_normalized)` and `UNIQUE(external_subject)` | App-only normalization; `citext`; provider-specific `google_subject` | Normalization belongs in PostgreSQL so every writer gets the same canonical key. `external_subject` stays provider-opaque without pulling auth logic into the slice. |
| Subscription windows | `subscriptions(period_start, period_end, effective_window GENERATED ALWAYS AS (tstzrange(period_start, period_end, '[)')) STORED)` + `CHECK(period_end > period_start)` + `EXCLUDE USING gist (user_id WITH =, effective_window WITH &&)` | App-only overlap checks; trigger-only enforcement | The spec requires overlap rejection. PostgreSQL exclusion constraints are the smallest reliable source of truth; this needs `btree_gist`. |
| Access truth + fixed-unit ledger | Access is computed in Nest service from persisted status + current time; `usage_ledger` stores only `analisis_documento`/`generacion_documento`, `units INTEGER NOT NULL DEFAULT 1 CHECK (units = 1)` | Derived DB view for access; generic quota table | PostgreSQL enforces allowed shapes, while the application computes “has access now” without adding premature billing machinery. |
| Append-only + RLS | `usage_ledger` gets a trigger that rejects `UPDATE/DELETE`; `users`, `subscriptions`, `usage_ledger` enable **FORCE RLS** with policies bound to `current_setting('app.current_user_id', true)` | App convention only; defer RLS | Closed decisions require early RLS and immutable usage. FORCE RLS matters because the app currently connects with a single role. |
| Migration strategy | Versioned SQL files under `apps/api/src/infrastructure/postgres/migrations/` plus a tiny runner/journal table, invoked explicitly via script | ORM migrations; auto-run on bootstrap | The repo already uses raw `pg` and has no ORM. Explicit migrations keep bootstrap clean and fit current maturity. |

## Data Flow

Future use case / controller
  → `DomainSchemaFirstService`
  → owner-scoped Postgres session (`BEGIN` + `SET LOCAL app.current_user_id = $ownerId`)
  → `UsersRepository` / `SubscriptionsRepository` / `UsageLedgerRepository`
  → PostgreSQL constraints, RLS policies, append-only trigger

Bootstrap paths (`/health`, `/ready`) continue using `PostgresService` only and do not touch owner tables.

## File Changes

| File | Action | Description |
|---|---|---|
| `apps/api/src/app.module.ts` | Modify | Import the new persistence module without changing health wiring. |
| `apps/api/src/domain-schema-first/domain-schema-first.module.ts` | Create | Feature wiring for service + repositories. |
| `apps/api/src/domain-schema-first/domain-schema-first.service.ts` | Create | Minimal application boundary for owner-scoped reads/writes and access evaluation. |
| `apps/api/src/domain-schema-first/contracts.ts` | Create | Slice DTO/record types only. |
| `apps/api/src/infrastructure/postgres/postgres.service.ts` | Modify | Add transaction/query helpers and owner-scoped session support. |
| `apps/api/src/infrastructure/postgres/repositories/{users,subscriptions,usage-ledger}.repository.ts` | Create | Raw SQL repositories for this slice. |
| `apps/api/src/infrastructure/postgres/migrations/0001_domain_schema_first.sql` | Create | Tables, indexes, `btree_gist`, RLS policies, append-only trigger, migration journal bootstrap. |
| `apps/api/src/infrastructure/postgres/migrate.ts` | Create | Explicit migration runner; never called from `main.ts`. |
| `apps/api/package.json` | Modify | Add `db:migrate` script. |
| `apps/api/src/bootstrap.boundaries.spec.ts` | Modify | Allow only the approved persistence slice/migration path and keep other domains absent. |

## Interfaces / Contracts

```ts
type AccessStatus = "activa" | "limitada" | "sin_acceso" | "cancelada";
type UsageOperation = "analisis_documento" | "generacion_documento";

interface DomainSchemaFirstService {
  createUser(input: { email: string; displayName: string; externalSubject: string }): Promise<UserRecord>;
  createSubscription(input: { userId: number; status: AccessStatus; periodStart: Date; periodEnd: Date }): Promise<SubscriptionRecord>;
  getAccessState(userId: number, now: Date): Promise<{ hasAccess: boolean; subscriptionId: number | null }>;
  appendUsage(input: { userId: number; subscriptionId?: number | null; operationType: UsageOperation }): Promise<UsageLedgerRecord>;
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit | Access evaluation and owner-scoped session helper | Vitest with repository/service doubles. |
| Integration | Generated email normalization, duplicate identity rejection, period overlap exclusion, `units = 1`, append-only trigger, RLS filtering by `app.current_user_id` | PostgreSQL-backed tests against isolated test DB. |
| Process/contract | `db:migrate` applies cleanly; `/health` and `/ready` still behave as today | Extend current process/boundary tests. |

## Migration / Rollout

No data backfill is required. Apply one explicit SQL migration to empty dev/test databases first. PostgreSQL enforces: identity uniqueness, normalized email key, period validity, no overlap, fixed operation catalog, `units = 1`, append-only ledger, and RLS. MVP application enforcement remains limited to: setting the owner context (`app.current_user_id`), computing current access from persisted rows, and avoiding higher-order workflows such as auth onboarding or billing state machines.

## Open Questions

- [ ] If MVP auth later adds more than one provider, `external_subject` must become `(identity_provider, external_subject)` unique instead of standalone.
