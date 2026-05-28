# Tasks: client-wizard-flow

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~1,200 (new) + ~300 (modified) = ~1,500 total |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2 → PR 3 → PR 4 |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Infrastructure foundation: contracts package + workspace setup | PR 1 | Base = main; self-contained |
| 2 | Wizard state machine: types, context, reducer, storage lib | PR 2 | Base = PR 1; core logic |
| 3 | Mock service layer: MSW handlers + test fixtures | PR 3 | Base = PR 2; independent but stacks cleanly |
| 4 | Wizard UI components + page refactors | PR 4 | Base = PR 3; all wiring |

---

## Phase 1: Infrastructure Foundation

- [ ] 1.1 Create `packages/contracts/package.json` — name `@template-ai/contracts`, dep `zod`, no runtime deps
- [ ] 1.2 Create `packages/contracts/tsconfig.json` — `declaration: true`, `outDir: dist`, `jsx: preserve`
- [ ] 1.3 Create `packages/contracts/src/schemas.ts` — `DocumentSchema`, `EntitySchema`, `AnalysisResultSchema`, `TemplateSchema` with Zod + inferred types
- [ ] 1.4 Create `packages/contracts/src/index.ts` — barrel re-exports of all schemas + z.infer types
- [ ] 1.5 Update `pnpm-workspace.yaml` — add `packages/*` to packages list
- [ ] 1.6 Verify contracts package builds: `cd packages/contracts && pnpm tsc`

## Phase 2: Wizard State Machine

- [ ] 2.1 Create `apps/web/src/context/wizard-types.ts` — `WizardStep` enum (upload/analysis/review/save), state interface, action union
- [ ] 2.2 Create `apps/web/src/context/wizard-context.tsx` — `WizardProvider`, `wizardReducer`, `useWizard` hook; step gating, URL `?step=` sync
- [ ] 2.3 Create `apps/web/src/lib/storage.ts` — `loadDraft`, `saveDraft`, `clearDraft` with `template-draft:v1` key and version check
- [ ] 2.4 Verify context mounts: `pnpm --filter web typecheck` (no new errors)

## Phase 3: Mock Service Layer

- [ ] 3.1 Create `apps/web/src/mocks/data/analysis-result.ts` — realistic mock with 8+ entities, all fields
- [ ] 3.2 Create `apps/web/src/mocks/handlers.ts` — `POST /api/documents/upload`, `GET /api/analysis/:documentId`, `PATCH /api/entities/:entityId`, `POST /api/templates` with latency simulation
- [ ] 3.3 Create `apps/web/src/mocks/browser.ts` — MSW `setupWorker` export
- [ ] 3.4 Update `apps/web/package.json` — add `msw` (dev), `react-hook-form`, `@hookform/resolvers`, `zod` deps
- [ ] 3.5 Verify MSW handlers compile: `pnpm --filter web typecheck`

## Phase 4: Wizard UI Components

- [ ] 4.1 Create `apps/web/src/components/wizard/step-indicator.tsx` — 4-step visual indicator with completed/current/pending states
- [ ] 4.2 Create `apps/web/src/components/wizard/wizard-layout.tsx` — wraps page content, syncs `?step=` with WizardContext
- [ ] 4.3 Create `apps/web/src/components/upload/file-dropzone.tsx` — native HTML5 DnD, Zod file validation (PDF/DOCX/JPG, 25MB max), file card with remove
- [ ] 4.4 Create `apps/web/src/components/review/entity-inspector.tsx` — expandable groups, confidence badges (ALTA/MEDIA/BAJA), confidence filter

## Phase 5: Page Refactors

- [ ] 5.1 Refactor `apps/web/src/app/upload/page.tsx` — add `'use client'`, wire `FileDropzone`, set file in context, navigate on upload complete
- [ ] 5.2 Refactor `apps/web/src/app/analysis/page.tsx` — add `'use client'`, polling logic (800ms interval), skeleton→content CSS transition, set `analysisResult` in context
- [ ] 5.3 Refactor `apps/web/src/app/review/page.tsx` — add `'use client'`, wire `EntityInspector`, patch entity edits via mock, confirm action
- [ ] 5.4 Refactor `apps/web/src/app/save/page.tsx` — add `'use client'`, `react-hook-form` + Zod validation, mock submit, success state, clear draft on complete
- [ ] 5.5 Update `apps/web/src/app/layout.tsx` — init MSW worker in `useEffect` when `NEXT_PUBLIC_MSW=true`

## Phase 6: Testing

- [ ] 6.1 Unit test `wizardReducer` — test each action (setFile, setAnalysisResult, nextStep, prevStep, reset); cover valid/invalid step transitions
- [ ] 6.2 Unit test Zod schemas — valid/invalid payloads for all 4 schemas
- [ ] 6.3 Unit test MSW handlers — call handlers directly, assert response shape and status codes
- [ ] 6.4 Integration test `FileDropzone` → context → navigation (RTL)
- [ ] 6.5 Verify all tests pass: `pnpm --filter web test`
