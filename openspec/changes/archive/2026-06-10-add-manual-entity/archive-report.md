# Archive Report: add-manual-entity

**Archived**: 2026-06-10
**Change**: Add Manual Entity Creation
**Store**: hybrid (OpenSpec + Engram)
**Verdict**: ready-for-archive ✅

## Summary

Enable users to create entities manually via text selection with AI-assisted classification, capped at 5 per document and gated by subscription tier. Users select text in the document preview, the system classifies the span via AI (`POST /api/review/:resultId/entities/classify-span`), pre-fills a create modal, and persists the entity on confirmation (`POST /api/review/:resultId/entities`).

## Key Deliverables

- **Text selection flow** with `window.getSelection()` + Range API, UTF-16 safe offset computation
- **AI classification endpoint** with narrow single-span prompt (`temperature=0`, `max_tokens=150`)
- **EntityCreateModal** reusing EntityEditModal dialog with `mode="create"` (editable label, group dropdown, confidence locked ALTA)
- **5-entity cap** enforced server-side (403 `MANUAL_ENTITY_LIMIT_REACHED`) and client-side
- **"+ AGREGAR CAMPO"** in all 4 group headers and empty states
- **ADD_ENTITY** action in wizard reducer + `addEntity()` context method
- **Error handling**: auto-retry, "Reintentar" button, "Agregar manualmente" fallback
- **MSW handlers** for all API endpoints with error scenario support

## Specs Synced

| Domain | Action | Details |
|--------|--------|---------|
| `entity-editing` | Updated | Modal trigger: added `mode="create"` support, locked ALTA confidence, editable label; added EntityCreateModal requirement (4 new scenarios) |
| `client-wizard-flow` | Updated | Review entity interaction: added "+ AGREGAR CAMPO" button in group headers; added ADD_ENTITY reducer action, addEntity() context method, text selection mode state (3 new requirements, 5 new scenarios) |
| `subscription-access` | Updated | Added manual entity limit per document (5) and subscription tier gating (2 new requirements, 5 new scenarios) |
| `shared-contracts` | Updated | Added ClassifySpanRequest schema, ClassifySpanResponse schema, MANUAL_ENTITY_LIMIT constant (3 new requirements, 4 new scenarios + notes) |
| `manual-entity-creation` | Created (canonical) | Full spec for the new feature — 7 requirements, 14 scenarios |

## Files Changed (25 files)

### PR1: Backend (~380 lines)
- `packages/contracts/src/schemas.ts` — ClassifySpanRequest/Response schemas, `userCreated`, `MANUAL_ENTITY_LIMIT`
- `packages/contracts/src/index.ts` — exports
- `packages/contracts/src/schemas.test.ts` — Zod schema tests
- `apps/api/src/ai/open-router.service.ts` — `classifySpan(text, context)` with narrow prompt
- `apps/api/src/ai/open-router.service.spec.ts` — unit tests
- `apps/api/src/review/review.service.ts` — `classifySpan`, `createEntity`, `countManualEntities`
- `apps/api/src/review/review.service.spec.ts` — service tests
- `apps/api/src/review/review.controller.ts` — classify-span + create-entity endpoints
- `apps/api/src/review/review.controller.spec.ts` — controller tests
- `apps/api/src/review/review.controller.integration.spec.ts` — integration tests
- `apps/api/src/review/review.module.ts` — AiModule import
- `apps/api/src/infrastructure/postgres/repositories/entities.repository.ts` — `userCreated`, `countUserCreated`
- Migration `0007_user_created_entities.sql` — `user_created BOOLEAN NOT NULL DEFAULT false`

### PR2: Frontend (~370 lines)
- `apps/web/src/lib/wizard/types.ts` — `ADD_ENTITY` action
- `apps/web/src/lib/wizard/wizardReducer.ts` — ADD_ENTITY handler
- `apps/web/src/lib/wizard/wizardReducer.test.ts` — reducer tests
- `apps/web/src/lib/wizard/WizardContext.tsx` — `addEntity()` method
- `apps/web/src/lib/wizard/useTextSelection.ts` — new text selection hook (Range API)
- `apps/web/src/lib/wizard/useTextSelection.test.ts` — hook tests
- `apps/web/src/components/wizard/EntityEditModal.tsx` — `mode="create"` support
- `apps/web/src/components/wizard/EntityEditModal.test.tsx` — create mode tests
- `apps/web/src/components/wizard/EntityInspector.tsx` — "+ AGREGAR CAMPO" + limit enforcement
- `apps/web/src/components/wizard/EntityInspector.test.tsx` — first coverage (12 tests)
- `apps/web/src/app/review/page.tsx` — selection mode, classify, modal orchestration
- `apps/web/src/mocks/handlers.ts` — MSW handlers for classify/create/manual-count
- `apps/web/src/lib/wizard/storage.test.ts` — adapted for userCreated field

## API Endpoints Added

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/review/:documentId/entities/classify-span` | AI classification of selected text span |
| POST | `/api/review/:documentId/entities` | Persist confirmed manual entity |

## Test Results

| Package | Pass | Fail | Files |
|---------|------|------|-------|
| @template-ai/contracts | 25 | 0 | 1 |
| @template-ai/api | 283 | 0 | 29 |
| @template-ai/web | 112 | 0 | 9 |
| **Total** | **420** | **0** | **39** |

All 420 tests pass with zero regressions.

## PR Chain

- **PR #4** (backend, `feature/add-manual-entity-be` ← `feature/add-manual-entity`): 9 tasks (BE-1 through BE-9), ~380 lines
- **PR #5** (frontend, `feature/add-manual-entity-fe` ← `feature/add-manual-entity-be`): 10 tasks (FE-1 through FE-10), ~370 lines
- **Strategy**: stacked-to-main (feature-branch-chain)
- **Tracker branch**: `feature/add-manual-entity`
- **Commits**: 6 work-unit commits per conventional commits

## Verification Outcome

**Initial status**: FAIL (2 CRITICAL issues)
- C1: Missing "Reintentar" button on classification error
- C2: Missing "Agregar manualmente" fallback

**Re-verified 2026-06-10**: PASS ✅
- Both C1 and C2 resolved in `review/page.tsx` (lines 299-331)
- `classifyFnRef` pattern correctly captures latest closure for retry
- Fallback opens EntityEditModal with empty label and default group
- All 112 web tests pass including retry + fallback scenarios

**Non-blocking warnings**:
- W1: Feature flag `manualEntityCreation.enabled` not implemented (design requirement, not spec)
- W2: Pre-existing hardcoded string in biblioteca page (not in scope)
- W3: Controller uses `:documentId` vs design's `:resultId` (documented deviation in tasks.md)

## Lessons Learned

1. **HTML limitation**: `<button>` inside `<button>` is invalid HTML — changed group headers from `<button>` to `<div>` with `onClick` to allow nested "+ AGREGAR CAMPO" button
2. **utf-16 offsets**: `useTextSelection` uses Range API with text node traversal — correct for multi-byte Spanish characters (accents, ñ)
3. **Reused dialog pattern**: EntityCreateModal reuses EntityEditModal via `mode="create"` — avoids duplicating dialog chrome, backdrop, escape-key logic
4. **E2E limitations**: Playwright E2E skip (FE-10) due to no Playwright setup in project — mitigated by unit + integration test coverage
5. **Spec vs design deviations**: Tasks.md explicitly documented `:documentId` vs `:resultId` deviation — design-review alignment caught before implementation
6. **Ref pattern for retry**: `classifyFnRef` solves stale closure problem for retry callbacks in React useEffect
7. **Server as source of truth**: 5-entity cap enforced server-side even when client disables button — prevents bypass

## Open Items

- Playwright E2E setup and test for full selection → classification → confirmation flow
- Feature flag gating (`manualEntityCreation.enabled`) per design requirement
- Higher subscription tier limits (>5 manual entities)
