# Tasks: Content Title Decoupling & Lowercase Export Fix

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: Low

**Forecast**: PR-5 ~50 lines, PR-6 ~280 lines. Tracker `feature/inline-name-editing`.

**[BLOCKER] 0.1** PR-4 code (EditableTitle, useInlineEdit, DocumentViewer.onRenameTitle, updateCase signal) must exist at PR-5 base; merge `1a9a717`/`7292604` into PR-4 branch if missing.

## Phase 1 — PR-5 (frontend, base: PR-4 branch)

- [x] 1.1 `ExportPanel.tsx`: rename `templateSlug`→`filenameSlug`; add `displayTitle`; pass as `title` to `generatePdf`/`generateDocx`; `filenameSlug`→`buildFilename`.
- [x] 1.2 `PreviewPageContent.tsx`: pass `displayTitle={name ?? template.name}` + `filenameSlug={slugify(name ?? template.name)}` to ExportPanel.
- [ ] 1.3 RED `ExportPanel.test.tsx`: heading=`displayTitle`, filename=`filenameSlug` (mock generators).
- [ ] 1.4 RED `PreviewPageContent.test.tsx`: props = `name ?? template.name` + `slugify(...)`.
- [x] 1.5 GREEN `pnpm --filter web test` + `pnpm --filter web typecheck`. Open PR-5 → PR-4 branch.

## Phase 2 — PR-6 (full stack, base: PR-5 branch)

- [x] 2.1 `0015_casos_content_title.sql`: `ALTER TABLE casos ADD COLUMN IF NOT EXISTS content_title TEXT NULL;` Verify `\d casos` shows `content_title | text |`.
- [x] 2.2 `cases.repository.ts`: add `contentTitle: string | null` to `CaseRecord`; add `c.content_title` to `CASE_SELECT`; map in `rowToCase`; add `updateContentTitle()` mirroring `updateName`.
- [x] 2.3 `cases.service.ts`: add `contentTitle` + `effectiveTitle` to `CaseResponse`; `contentTitle?` to `UpdateCaseData`.
- [x] 2.4 `mapToResponse`: `effectiveTitle = contentTitle ?? name ?? template.name`.
- [x] 2.5 Add `updateContentTitle(id, contentTitle)` service method.
- [x] 2.6 `cases.controller.ts`: PATCH `contentTitle !== undefined` → `service.updateContentTitle(id, contentTitle)`.
- [x] 2.7 `packages/contracts/src/schemas.ts`: add `contentTitle: z.string().nullable().optional()` to `CaseSchema` + `UpdateCaseFormDataSchema`.
- [x] 2.8 RED `schemas.test.ts`: string/null/missing accepted; PATCH `{ contentTitle: "X" }` accepted. GREEN `pnpm --filter contracts test`.
- [x] 2.9 `apps/web/src/lib/api/cases.ts`: add `CaseWithTemplateResponse extends CaseWithTemplate { contentTitle: string | null; effectiveTitle: string }` (frontend-local). `fetchCase` returns it.

- [ ] 2.10 RED `cases.test.ts`: `fetchCase` returns `effectiveTitle` per chain. **No backend** (mock fetch).
- [x] 2.11 `DocumentViewer.tsx`: add `contentTitle?`, `onRenameContentTitle?`, `contentTitleFallback?` props. Render 2nd `<EditableTitle>` below h1, label `"Título del documento"`. Editor = raw; fallback muted when null.
- [ ] 2.12 RED `DocumentViewer.test.tsx`: two EditableTitle; `onRenameContentTitle` on Enter; `onRenameTitle` unaffected; Escape cancels.
- [x] 2.13 `PreviewPageContent.tsx`: `handleRenameContentTitle(v, sig?)` → `updateCase(id, { contentTitle: v }, sig)`. Pass `effectiveTitle`→`displayTitle` to ExportPanel. `contentTitleFallback={name ?? template.name}` to DocumentViewer.
- [ ] 2.14 RED `PreviewPageContent.test.tsx`: `updateCase` called with `{ contentTitle }`; `displayTitle` = `effectiveTitle`.
- [ ] 2.15 RED `cases.service.test.ts`: `mapToResponse` 3-level chain; `updateContentTitle` round-trip. Mock repo. **No backend**.
- [ ] 2.16 RED `cases.controller.test.ts`: PATCH `{ contentTitle }` routes. **No backend.**
- [ ] 2.17 If integration tests exist, mark `@requires backend`; gate `RUN_INTEGRATION=1`.
- [ ] 2.18 Playwright E2E: `/preview/[id]` → edit "Título del documento" to "Compraventa" → Enter → export PDF → filename `compraventa.pdf` + heading "Compraventa"; h1 unchanged. **Full stack**. Gate `RUN_E2E=1`.
- [x] 2.19 `pnpm -r test` + `pnpm -r typecheck`.
- [ ] 2.20 Manual smoke: create case → PATCH contentTitle → 2nd EditableTitle → export PDF heading = contentTitle (casing), filename slugified; h1 unchanged.
- [ ] 2.21 Open PR-6 → tracker. Review: migration safety, fallback chain, PATCH routing, no PR-5 regressions.

## Notes

- API unit tests (2.10, 2.15–2.16): mocked → no backend. E2E (2.18): full stack → `RUN_E2E=1`.
