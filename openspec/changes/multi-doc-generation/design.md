# Design: Fix Multi-Document Generation Bug

## Technical Approach

Three-part defense-in-depth fix. **Layer 1 (frontend)** makes bootstrap and the generate/regenerate handlers re-entry safe via `useRef<boolean>` in-flight guards plus an `AbortController` threaded into `createCase`/`fetchTemplate` through `safeFetch(signal)`. **Layer 2 (backend)** makes `POST /api/cases` idempotent for the borrador of a `(userId, templateId)` pair by find-before-insert inside the existing `withOwnerTransaction`. The controller differentiates 201 (created) vs 200 (existing) so the contract matches the spec. TDD: integration spec for "two POSTs return same id" is written first.

## Architecture Decisions

### Decision: Pass `signal` through `safeFetch` instead of relying on the `cancelled` flag
**Choice**: Add optional `signal?: AbortSignal` to `safeFetch` and `createCase`; bootstrap owns one `AbortController` aborted on cleanup.
**Alternatives**: Keep `cancelled` boolean only (status quo — aborts `setState`, NOT the POST); module-level request dedup.
**Rationale**: `cancelled` leaves the POST in flight, the orphan row is inserted anyway. `AbortController` actually cancels the network request; the ref guard below short-circuits BEFORE `fetch` fires.

### Decision: `useRef<boolean>` in-flight guards over framework guarantees
**Choice**: `bootstrapInFlight = useRef(false)` checked-and-set synchronously at effect start; `generationInFlight` ref in `handleGenerate` / `handleRegenerate` checked before any async work, reset in `finally`.
**Alternatives**: Trust `disabled` prop only; debounce clicks; disable button synchronously via state mutation.
**Rationale**: `setStatus("generating")` is async — a second click within the same tick slips through before React commits the disabled state. Refs mutate synchronously, so the guard is set before the await yields. Spec explicitly forbids `disabled` as the only defense.

### Decision: Find-before-insert within the same owner transaction; first-created wins
**Choice**: `CasesService.create` calls new `repo.findBorradorByUserAndTemplate(userId, templateId)` before INSERT, both inside `withOwnerTransaction`; existing borrador returned as-is.
**Alternatives**: DB partial unique index + `ON CONFLICT DO NOTHING`; `Idempotency-Key` header; merge duplicates on next visit.
**Rationale**: Proposal scope excludes migrations and `Idempotency-Key`. Same transaction guarantees the find and insert see one RLS context. First-created-wins (ORDER BY created_at ASC LIMIT 1) reclaims orphan rows from aborted frontends deterministically.

### Decision: Controller sets 201 vs 200 via `@Res({ passthrough: true })`
**Choice**: Service returns `{ case: CaseResponse, created: boolean }`; controller calls `res.status(created ? 201 : 200)`.
**Alternatives**: Static `@HttpCode(201)` (cannot vary); throw a 201-bearing exception (anti-pattern).
**Rationale**: Spec mandates 201 for new, 200 for existing. `passthrough` keeps Nest's body serialization while allowing dynamic status.

## Data Flow

    /nuevo/[templateId] mount
        │  ref guard (synchronous) ── short-circuit if in flight
        ▼
    AbortController ──signal──▶ fetchTemplate / createCase ──POST /api/cases──▶ CasesController.create
                                                                                    │ res.status(201|200)
                                                                                    ▼
                                           withOwnerTransaction(userId)
                                              │  findBorradorByUserAndTemplate
                                              │  ┌── found? return existing (created=false)
                                              │  └── else INSERT borrador, return (created=true)
                                              ▼
                                          RLS-scoped casos row (one per user+template)
    Generar click ──ref guard──▶ saveForm ──▶ generateCase ──▶ /preview (first-created wins)

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `apps/web/src/lib/api/cases.ts` | Modify | `safeFetch` + `fetchTemplate` + `createCase` accept optional `signal`; createCase passes `signal` into `safeFetch`. |
| `apps/web/src/app/nuevo/[templateId]/page.tsx` | Modify | Replace `cancelled` with `AbortController` + `bootstrapInFlight` ref; add `generationInFlight` ref to `handleGenerate`; ignore `AbortError` in catch. |
| `apps/web/src/app/preview/[caseId]/page.tsx` | Modify | Add `generationInFlight` ref to `handleRegenerate`. |
| `apps/api/src/infrastructure/postgres/repositories/cases.repository.ts` | Modify | Add `findBorradorByUserAndTemplate(userId, templateId)` returning `CaseRecord \| null` (reuses `CASE_SELECT`/`CASE_JOIN`, `WHERE c.user_id=$1 AND c.template_id=$2 AND c.status='borrador' ORDER BY c.created_at ASC LIMIT 1`). |
| `apps/api/src/cases/cases.service.ts` | Modify | `create` returns `{ case, created }`; find-before-insert inside existing transaction. |
| `apps/api/src/cases/cases.controller.ts` | Modify | `create` unwraps `{ case, created }`, sets status via `@Res({ passthrough: true })`. |
| `apps/api/src/cases/__tests__/cases.service.spec.ts` | Modify | New case: existing borrador returned without INSERT; mock `findBorrador` query branch. |
| `apps/api/src/cases/__tests__/cases.controller.integration.spec.ts` | Modify | New scenario: two sequential POSTs same `(user,template)` return same id; second 200. |
| `apps/web/src/app/nuevo/[templateId]/__tests__/page.test.tsx` | Create | Strict-mode double-mount → one POST; double-click → one `generateCase`; guard reset after error. (tests live under `src/**/*.test.{ts,tsx}` per vitest config) |

## Interfaces / Contracts

```ts
// cases.repository.ts
async findBorradorByUserAndTemplate(
  userId: number,
  templateId: string,
): Promise<CaseRecord | null>;

// cases.service.ts
async create(userId, data): Promise<{ case: CaseResponse; created: boolean }>;

// cases.controller.ts
@Post()
public async create(
  @Body() body: unknown,
  @Res({ passthrough: true }) res: Response,
): Promise<CaseResponse> { /* res.status(created ? 201 : 200); return c.case */ }

// api/cases.ts
export async function createCase(templateId: string, signal?: AbortSignal): Promise<Case>;
```

`CreateCaseRequestSchema` is unchanged (no contract delta).

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit (api) | `findBorrador` finds / returns null; service returns existing without INSERT | Vitest + mock client (`cases.service.spec.ts` pattern); extend `createMockPostgresService` to route the new find SQL. |
| Integration (api) | Two sequential `POST /api/cases` same `(user, template)` → same id, statuses 201 then 200; different template → different id | `DATABASE_URL` gate (`cases.controller.integration.spec.ts` pattern). Written FIRST (TDD). |
| Repository (api) | New find branch respects `status='borrador'` filter | `cases.repository.spec.ts` real-PG suite; insert two borradores → returns oldest. |
| Unit (web) | Double-mount triggers one `createCase`; unmount aborts; double-click fires `generateCase` once; guard resets after error | `@testing-library/react` + MSW fetch counter (`vitest jsdom`); render `<NewCasePageContent/>` in `CaseProvider`, assert call counts. |
| Smoke | `/nuevo/[id]` → fill → Generar → `/biblioteca` shows one new case `generado` | Manual / existing E2E if present. |

## Migration / Rollout

No DB migration. Revert = undo the three layers independently; Layer 2 is additive (find-before-insert), Layer 1 restores the `cancelled` flag. Existing orphan duplicates are reclaimed as the existing one on next visit (first-created wins); out-of-scope cleanup migration per proposal.

## Open Questions

- [ ] Concurrent identical POSTs (two sockets, not React double-mount) are sequential-only per spec. Without a partial unique index (excluded by "No DB migration"), a true race could still insert two rows. Acceptable given Layer 1 frontend guard + the reported bug is sequential? Confirm before apply.
- [ ] `withOwnerTransaction` uses READ COMMITTED; find-before-insert is NOT a serialization guard. If concurrent duplicates become a real concern post-fix, a partial unique index `WHERE status='borrador'` + `ON CONFLICT DO NOTHING` is the upgrade path — needs explicit migration approval.