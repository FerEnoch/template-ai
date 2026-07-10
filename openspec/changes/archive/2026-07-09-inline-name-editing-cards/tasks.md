# Tasks: Inline Name Editing across Biblioteca & Document Screens

## Review Workload Forecast

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High
Delivery: `force-chained` / `feature-branch-chain`. Tracker `feature/inline-name-editing`.

### Work Units

- **PR 1** — Foundation: API signal + `useInlineEdit` + `EditableName` refactor. `…-pr1` → tracker. ~200 lines.
- **PR 2** — `EditableTitle`. `…-pr2` → `pr-1`. ~280 lines.
- **PR 3** — Wire `/biblioteca/[id]` + `/nuevo/[templateId]`. `…-pr3` → `pr-2`. ~180 lines. PR 3 only needs PR 1; rebases on `pr-2` so its diff shows only its own changes.
- **PR 4** — Wire `/preview/[caseId]` + E2E. `…-pr4` → `pr-3`. ~280 lines.

## PR 1 — Foundation

- [x] 1.1 Add optional `signal?: AbortSignal` to `updateCase` (`cases.ts`) and `updateTemplateName` (`templates.ts`); forward to `safeFetch`. TS-only.
- [x] 1.2 Create `components/biblioteca/useInlineEdit.ts` per design: draft/error/pending, `validate(3–200)`, Enter/blur/Escape, `AbortController`/save, `savingRef`, focus+select, unmount aborts. Aborted saves must NOT revert or set error.
- [x] 1.3 Refactor `EditableName.tsx` to consume `useInlineEdit`; extend `onSave` to `(value, signal?) => Promise<void>`. All 6 existing tests still pass.
- [x] 1.4 Add `useInlineEdit.test.tsx`: Enter saves, Escape cancels, blur-unchanged skips, < 3 stays + inline error, whitespace rejected, rejection reverts, `AbortError` ignored, unmount aborts.
- [x] 1.5 `pnpm --filter web test` + typecheck pass.

## PR 2 — `EditableTitle`

- [x] 2.1 Create `components/preview/EditableTitle.tsx` (`{ value, onSave, children, className, inputClassName, minLength, maxLength }`). Consumes `useInlineEdit`. Non-editing = `children` + `Pencil` icon on `group-hover`; icon click → `startEdit`; wrapper stops propagation.
- [x] 2.2 Input: `font-headline`, focus ring, `aria-invalid`, `aria-describedby`; respect overrides. Error via `errorClassName`.
- [x] 2.3 Add `EditableTitle.test.tsx`: icon hidden default + visible on hover; icon click focuses pre-filled input; Enter saves, Escape reverts, blur saves, blur-unchanged skips; < 3 inline error; rejection reverts; icon click does not bubble.
- [x] 2.4 Export from `preview/index.ts`. Typecheck + tests pass.

## PR 3 — Wire `/biblioteca/[id]` + `/nuevo/[templateId]`

- [x] 3.1 `app/biblioteca/[id]/page.tsx`: `handleRenameTemplate(name, signal)` → `updateTemplateName(id, name, signal)` + `setTemplate`; wrap `<h1>` with `EditableName value={template.name} onSave={handleRenameTemplate}`.
- [x] 3.2 `components/case/CaseProgress.tsx`: add required `onRename` prop; wrap `<h1>` with `EditableName value={caseName ?? template.name} onSave={onRename}`.
- [x] 3.3 `components/case/NewCaseLayout.tsx`: accept `onRename`, forward to `CaseProgress`.
- [x] 3.4 `app/nuevo/[templateId]/page.tsx`: `handleRenameCase(name, signal)` → `updateCase(id, { name }, signal)` + `dispatch({ type: 'SET_CASE_NAME', payload: name })`; pass to `NewCaseLayout onRename={...}`. Add `SET_CASE_NAME` to `CaseContext` reducer if absent.
- [x] 3.5 Integration tests: mock API, click+change+Enter, assert PATCH + state; PATCH failure does NOT dispatch `SET_CASE_NAME` and reverts UI.

## PR 4 — Wire `/preview/[caseId]` + E2E

- [x] 4.1 `DocumentViewer.tsx`: add `onRenameTitle` prop; replace static `<h1>` with `EditableTitle value={title} onSave={onRenameTitle}`. Icon position per design §"Open Questions".
- [x] 4.2 `PreviewPageContent.tsx`: `handleRenameTitle(name, signal)` → `updateCase(id, { name }, signal)` + `setCaseItem`; pass to `DocumentViewer`.
- [x] 4.3 Add `DocumentViewer.test.tsx`: mock `onRenameTitle`, hover title, click icon, change + Enter, assert call. Reuse `EditableTitle.test.tsx` patterns.
- [x] 4.4 Add `e2e/inline-name-editing.spec.ts`: biblioteca click+rename+reload persists; nuevo rename propagates via `CaseContext`; preview hover→icon→rename persists; rapid re-edit aborts first PATCH (assert `request.aborted()`).
- [x] 4.5 Unit tests + typecheck green; E2E for new spec passes. Pre-existing E2E failures in `biblioteca.spec.ts`, `wizard.spec.ts`, `errors.spec.ts`, and one `inline-rename.spec.ts` 409 test are unrelated to this PR (duplicate headings/links and flaky route ordering).
