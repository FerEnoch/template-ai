# Proposal: Fix Multi-Document Generation Bug

## Intent

Clicking "Generar documento" once produces multiple `casos` rows for the same template; the biblioteca renders them all as "Documentos Generados". User perceives one click as creating multiple documents.

## Root Cause

1. **Non-idempotent bootstrap (primary).** `apps/web/src/app/nuevo/[templateId]/page.tsx` lines 22–55: `useEffect` calls `createCase(templateId)` on every mount. The `cancelled` flag suppresses `setState` only — it does NOT abort the in-flight `POST /api/cases`. Under React 19, Fast Refresh, HMR, or future StrictMode, the effect re-runs and inserts a second row. State holds the latest id; the orphan stays in DB. `CaseList` lists ALL cases including `borrador`, so the user sees the orphan next to the generated one.
2. **Non-idempotent backend create.** `CasesService.create` and `CasesRepository.create` (lines 65–87) have no "find existing borrador" check. Duplicate `POST` → duplicate row.
3. **Generate handler re-entry (secondary).** `handleGenerate` (lines 67–103) has no in-flight guard. `setStatus("generating")` is async; a fast second click fires `generateCase` again before `disabled` propagates.

## Scope

### In Scope
- Idempotent bootstrap (AbortController + in-flight `useRef`)
- Idempotent `POST /api/cases` for same `(userId, templateId)`
- Re-entry guard in `handleGenerate` and `handleRegenerate`
- Tests: double-mount, two POSTs same id, double-click fires once

### Out of Scope
Biblioteca UI filtering, duplicate migration, `Idempotency-Key` header.

## Capabilities

### New Capabilities
None

### Modified Capabilities
- `client-wizard-flow` equivalent: bootstrap + generate handler gain re-entry guards
- Backend: `POST /api/cases` idempotent for borrador per `(userId, templateId)`

## Approach

**Layer 1 (frontend):** replace `cancelled` with `AbortController` passed to `safeFetch` (`api/cases.ts` accepts `signal`). `useRef<boolean>` "bootstrap in flight" short-circuits re-runs. `useRef<boolean>` "generating in flight" in `handleGenerate` / `handleRegenerate`.

**Layer 2 (backend, contract guarantee):** in `CasesService.create`, before INSERT, query for existing `borrador` for same `(userId, templateId)` inside `withOwnerTransaction`. If found, return it. Add `findBorradorByUserAndTemplate` to `CasesRepository`.

**TDD order:** integration test (two `POST /api/cases` return same id) written BEFORE implementation.

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Existing duplicates cause "merge" on next visit | Low | First-created wins by `createdAt` |
| Aborting `createCase` on unmount leaves orphan | Med | Layer 2 reclaims on next visit |
| Backend-only fix leaves frontend fragile | Med | Layer 1 is defense in depth |

## Rollback Plan

Revert commit(s) on `fix/multi-doc-generation`. Layer 2 is additive. Layer 1 reverts to `cancelled` flag. No DB migration.

## Dependencies

`withOwnerTransaction` in `PostgresService` + RLS context.

## Success Criteria

- [ ] Integration: two `POST /api/cases` for same `(user, template)` return same id
- [ ] Unit: double-mount of `NuevoCasoPage` triggers one `POST /api/cases`
- [ ] Unit: two clicks on Generar while `generating` do NOT trigger second `generateCase`
- [ ] Smoke: `/nuevo/[id]` → fill → Generar → `/biblioteca` — one new case, status `generado`
