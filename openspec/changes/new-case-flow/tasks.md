# Tasks: new-case-flow

## Review Workload Forecast

Total: ~1,260 lines. PRs: 150/350/380/380. Budget risk: Medium. Chained: Yes. Strategy: feature-branch-chain. Delivery: exception-ok.

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: Medium

Tracker: `feature/new-case-flow-tracker` (draft). Bases: PR#2→PR#1, PR#3→PR#2, PR#4→PR#3.

## Phase 1: PR #1 — Database + Contracts

- [x] 1.1 RED: Vitest schemas parse+reject (`schemas.test.ts`)
- [x] 1.2 RED: Integration applies 0009 + RLS (4 policies + 3 indexes)
- [x] 1.3 GREEN: Add 6 Zod schemas to `packages/contracts/src/schemas.ts`; re-export
- [x] 1.4 GREEN: Create `apps/api/src/infrastructure/postgres/migrations/0009_casos.sql`
- [x] 1.5 Verify: contracts green; `pnpm db:migrate` clean; cross-user returns 0

## Phase 2: PR #2 — API Layer + AI Service

- [ ] 2.1 RED: `cases.service.spec.ts` — mock repo, create/get/list/update/archive + 404/409
- [ ] 2.2 RED: `cases.controller.integration.spec.ts` — supertest, Zod/401/404/409/422/502
- [ ] 2.3 RED: `document-generation.service.spec.ts` — mock OpenRouter, prompt, 3-retry, NULL fallback
- [ ] 2.4 GREEN: `apps/api/src/infrastructure/postgres/repositories/cases.repository.ts` (RLS CRUD)
- [ ] 2.5 GREEN: `apps/api/src/cases/cases.service.ts` (orchestration)
- [ ] 2.6 GREEN: `apps/api/src/cases/cases.controller.ts` (5 endpoints + `safeParse` + error map)
- [ ] 2.7 GREEN: `apps/api/src/ai/document-generation.service.ts` (prompt + OpenRouter + retry)
- [ ] 2.8 Add `AI_GENERATION_MAX_TOKENS=16384` + `AI_GENERATION_TEMPERATURE=0.3` to `config/ai.ts`
- [ ] 2.9 Add `GET /api/templates/:id/extracted-text` to `templates.controller.ts`
- [ ] 2.10 Create `cases.module.ts`; register in `app.module.ts` + `ai.module.ts`

## Phase 3: PR #3 — New-Case Form UI

- [x] 3.1 RED: `CaseContext.test.tsx` — dispatch updates; pure reducer
- [x] 3.2 RED: `groupEntities.test.ts` — by `Entity.group` (PARTES→INMUEBLE→FECHAS→ANEXOS)
- [x] 3.3 RED: `inferFieldType.test.ts` — date/number/checkbox/text regex
- [x] 3.4 RED: `CaseStickyBar.test.tsx` — "Generar documento" disabled below 80%
- [x] 3.5 Create `apps/web/src/lib/api/cases.ts` (wrappers)
- [x] 3.6 GREEN: `apps/web/src/lib/case/CaseContext.tsx` (no `WizardContext` import)
- [x] 3.7 GREEN: `CaseForm.tsx`, `CaseFormSection.tsx`, `FieldRenderer.tsx` (rhf + zod)
- [x] 3.8 GREEN: `CaseProgress.tsx` + `CaseStickyBar.tsx`
- [x] 3.9 GREEN: `NewCaseLayout.tsx` + `apps/web/src/app/nuevo/[templateId]/page.tsx`
- [x] 3.10 Wire 30s auto-save + manual "Guardar borrador"
- [x] 3.11 Playwright: fill form → reload → data persisted

## Phase 4: PR #4 — Preview + Export

- [ ] 4.1 RED: `splitParagraphs.test.ts` — `\n\n` split + empty filter
- [ ] 4.2 RED: `EditableParagraph.test.tsx` — contenteditable + save/cancel + callback
- [ ] 4.3 RED: `VerificationChecklist.test.tsx` — 3 sections, local state
- [ ] 4.4 RED: `exporters.test.ts` — filename `${slug}-${id.slice(0,8)}.${ext}`
- [ ] 4.5 Add `jspdf@^2.5` + `docx@^8.5` to `apps/web/package.json`
- [ ] 4.6 GREEN: `apps/web/src/lib/export/pdf.ts` + `lib/export/docx.ts`
- [ ] 4.7 GREEN: `DocumentViewer.tsx` + `EditableParagraph.tsx` (PATCH on save)
- [ ] 4.8 GREEN: `VerificationChecklist.tsx` + `ExportPanel.tsx` + `ExportSpinner.tsx`
- [ ] 4.9 GREEN: `apps/web/src/app/preview/[caseId]/page.tsx` (case fetch + redirect guard)
- [ ] 4.10 Modify `apps/web/src/app/biblioteca/[id]/page.tsx` — "Crear nuevo caso" CTA
- [ ] 4.11 Playwright: form → generate → preview → export PDF + DOCX; assert `exportado`

## Phase 5: Verification (post-merge)

- [ ] 5.1 `pnpm typecheck` + `pnpm lint` + `pnpm format` pass
- [ ] 5.2 Vitest coverage ≥ 80% (api + web)
- [ ] 5.3 `madge`: `CaseProvider` zero `WizardContext` imports
- [ ] 5.4 `next build`: preview bundle delta ≤ 150KB gz
- [ ] 5.5 sdd-verify; archive deltas to `openspec/specs/`
