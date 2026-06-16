# Tasks: Add Manual Entity Creation

## Forecast
Lines: ~770 (PR1: 400 / PR2: 370). Risk: High. Chained: Yes. Strategy: stacked-to-main.

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Work Units
- **PR 1** (base: main) — backend: contracts, AI classify, cap, persist, tests, migration. Feature-flagged.
- **PR 2** (base: main) — frontend: selection, modal mode, wizard state, API call, tests. MSW mocks bridge contract drift.

> Flags: design adds `userCreated` column but `shared-contracts/spec.md` says "not required for MVP" — tasks follow design. Design says `:resultId`; real code uses `:documentId` — tasks use `:documentId`.

---

## PR 1: Backend

### 1.1 Contracts
- [x] BE-1 [TDD] Add `ClassifySpanRequest`, `ClassifySpanResponse`, `MANUAL_ENTITY_LIMIT=5` to `packages/contracts/src/schemas.ts`; export from `index.ts`; tests in `schemas.test.ts`. (~40)
- [x] BE-2 [TDD] Add `userCreated: z.boolean().default(false)` to `EntitySchema`; test. (~15)

### 1.2 AI
- [x] BE-3 [TDD] Add `classifySpan(text, context)` to `apps/api/src/ai/open-router.service.ts` (temp=0, max_tokens=150, strict JSON); tests in `open-router.service.spec.ts`. (~80)

### 1.3 Repository
- [x] BE-4 Migration: add `user_created BOOLEAN NOT NULL DEFAULT false` to entities in `apps/api/src/infrastructure/postgres/migrate.ts`. (~20)
- [x] BE-5 [TDD] Extend `EntitiesRepository` with `CreateEntityInput.userCreated` and `countUserCreated(documentId)`; tests. (~40)

### 1.4 Service
- [x] BE-6 [TDD] Add `classifySpan`, `createEntity`, `countManualEntities` to `ReviewService`; enforce limit (`ForbiddenException`); tests in `review.service.spec.ts`. (~100)
- [x] BE-7 Import `AiModule` in `apps/api/src/review/review.module.ts`; inject `OpenRouterService`. (~5)

### 1.5 Controller
- [x] BE-8 Add `POST :documentId/entities/classify-span` and `POST :documentId/entities` to `ReviewController`; gate by `manualEntityCreation.enabled` env; tests in `review.controller.spec.ts` + integration. (~80)
- [x] BE-9 E2E API test (supertest): classify → confirm → persist + 403 at cap. (~20)

---

## PR 2: Frontend

### 2.1 Wizard state
- [x] FE-1 [TDD] Add `ADD_ENTITY` to `WizardAction` union in `apps/web/src/lib/wizard/types.ts`. (~5)
- [x] FE-2 [TDD] Handle `ADD_ENTITY` in `wizardReducer.ts` (append, recompute manual count); tests. (~30)
- [x] FE-3 Add `addEntity(entity)` to `WizardContext.tsx` (dispatch + persist draft). (~15)

### 2.2 Modal
- [x] FE-4 [TDD] Extend `EntityEditModal.tsx` with `mode: "edit"|"create"`: editable label, group dropdown, confidence locked ALTA, "Agregar" button; tests. (~70)
- [x] FE-5 [TDD] Add `useManualEntityCount()` selector hook. (~20)

### 2.3 Inspector & selection
- [x] FE-6 [TDD] Add "+ AGREGAR CAMPO" to group headers + empty states in `EntityInspector.tsx`; disable + tooltip at limit. (~40)
- [x] FE-7 [TDD] Implement `useTextSelection(articleRef, extractedText)` in `apps/web/src/app/review/page.tsx` (Range API walk, UTF-16 offsets, ±100 char context). (~80)

### 2.4 Wiring
- [x] FE-8 [TDD] Add selection mode, classify call, modal orchestration, ADD_ENTITY dispatch, optimistic cap check in `review/page.tsx`. (~70)
- [x] FE-9 [TDD] Add MSW handlers for `/classify-span` and `POST /entities` in `apps/web/src/mocks/handlers.ts`. (~20)
- [x] FE-10 Playwright e2e: select text → classify → confirm → "Con traza" badge. (~20)

---

## Verification

- **PR1**: `pnpm --filter @template-ai/api test` green; `pnpm migrate` clean; `curl /classify-span` returns 403 at 5 entities.
- **PR2**: `pnpm --filter @template-ai/web test` green; e2e Playwright green; visual check of cursor + modal pre-fill.

## Out of scope
Higher-tier limits, re-classification flow, in-preview span highlight (covered by "Con traza" badge).
