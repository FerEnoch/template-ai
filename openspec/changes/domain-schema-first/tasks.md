# Tasks: Domain Schema First

## Phase 1: Migration foundation
_Complete when an empty DB can be migrated and PostgreSQL enforces the slice invariants from spec/design._

- [x] 1.1 Create `apps/api/src/infrastructure/postgres/migrate.ts` and a migration journal flow that applies versioned SQL files explicitly, never from `main.ts`.
- [x] 1.2 Add `apps/api/src/infrastructure/postgres/migrations/0001_domain_schema_first.sql` with `users`, `subscriptions`, `usage_ledger`, `btree_gist`, generated columns, FK indexes, RLS policies, and the append-only trigger.
- [x] 1.3 Update `apps/api/package.json` with `db:migrate`, then validate on a clean DB that the journal, tables, indexes, exclusion constraint, RLS, and trigger exist as required by `account-ownership`, `subscription-access`, and `usage-ledger`.

## Phase 2: Postgres plumbing and repositories
_Complete when Nest can open owner-scoped transactions and persist the three tables through raw SQL only._

- [x] 2.1 Extend `apps/api/src/infrastructure/postgres/postgres.service.ts` with transaction helpers plus `SET LOCAL app.current_user_id` owner-session support used only inside business transactions.
- [x] 2.2 Create `apps/api/src/infrastructure/postgres/repositories/users.repository.ts` for canonical user inserts/reads that rely on DB-enforced normalized email and external-subject uniqueness.
- [x] 2.3 Create `apps/api/src/infrastructure/postgres/repositories/subscriptions.repository.ts` for subscription inserts/reads using persisted status and period windows, leaving overlap rejection to PostgreSQL.
- [x] 2.4 Create `apps/api/src/infrastructure/postgres/repositories/usage-ledger.repository.ts` for append-only inserts and owner-scoped queries without update/delete paths.
- [x] 2.5 Validate with repository-level tests or targeted DB checks that owner context filters rows and that cross-user reads are denied/hidden per spec.

## Phase 3: NestJS slice integration
_Complete when the approved module boundary exists without pulling in auth, billing, templates, or controllers._

- [x] 3.1 Create `apps/api/src/domain-schema-first/contracts.ts` with slice-only records and input types for users, subscriptions, access state, and usage operations.
- [x] 3.2 Create `apps/api/src/domain-schema-first/domain-schema-first.service.ts` to orchestrate repositories, compute `hasAccess` from persisted status/window, and append usage with optional `subscriptionId`.
- [x] 3.3 Create `apps/api/src/domain-schema-first/domain-schema-first.module.ts` and update `apps/api/src/app.module.ts` to register only this persistence slice beside existing health wiring.
- [x] 3.4 Add `apps/api/src/domain-schema-first/domain-schema-first.service.spec.ts` covering access evaluation and owner-scoped transaction orchestration from the design contract.

## Phase 4: Boundary and integration verification
_Complete when process/boundary tests prove the slice is present and everything else stays out of scope._

- [x] 4.1 Create `apps/api/src/infrastructure/postgres/domain-schema-first.integration.spec.ts` for duplicate identity rejection, subscription overlap rejection, `units = 1`, allowed operation types, append-only trigger, and RLS isolation.
- [x] 4.2 Update `apps/api/src/bootstrap.boundaries.spec.ts` to allow only `domain-schema-first`, migration assets, and repositories under `infrastructure/postgres`, while still rejecting auth, templates, cases, billing, documents, and audit systems.
- [x] 4.3 Update `apps/api/src/main.process.spec.ts` and any affected readiness tests so `/health` and `/ready` stay bootstrap-safe and `db:migrate` remains explicit rather than startup-driven.

(End of file - total 39 lines)