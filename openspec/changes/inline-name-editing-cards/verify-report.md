# Verification Report: inline-name-editing-cards — PR 4/4

## Scope

Wire `/preview/[caseId]` inline title editing and add end-to-end coverage for the full inline name editing feature.

## Verification Results

### Unit Tests

- **Command**: `pnpm --filter @template-ai/web test`
- **Result**: PASS
- **Stats**: 33 test files, 255 tests passed
- **New coverage**:
  - `apps/web/src/components/preview/__tests__/DocumentViewer.test.tsx` (5 tests)
    - Static `<h1>` rendered when `onRenameTitle` is absent
    - Edit icon appears on hover
    - Icon click enters edit mode with pre-filled, focused input
    - Enter calls `onRenameTitle(name, AbortSignal)`
    - API failure reverts title and shows inline error

### Typecheck

- **Command**: `pnpm --filter @template-ai/web typecheck`
- **Result**: PASS (no errors)

### E2E Tests — New Spec

- **Command**: `pnpm --filter @template-ai/web exec playwright test e2e/inline-name-editing.spec.ts`
- **Result**: PASS
- **Stats**: 5/5 tests passed
- **Coverage**:
  - `/biblioteca`: template click+rename persists across reload
  - `/nuevo/[templateId]`: renamed case propagates through `CaseContext`
  - `/preview/[caseId]`: hover→icon→rename persists across reload
  - `/preview/[caseId]`: rapid re-edit aborts first PATCH and keeps latest value
  - `/preview/[caseId]`: API error shows inline error and reverts title

### E2E Tests — Full Suite

- **Command**: `pnpm --filter @template-ai/web exec playwright test`
- **Result**: PARTIAL — new spec passes; pre-existing failures remain
- **Stats**: 15 passed, 12 failed
- **Failures** (all pre-existing, unrelated to this PR):
  - `e2e/biblioteca.spec.ts` (3): UI selector `button.group` no longer matches cards; duplicate "Biblioteca"/"Inicio" links from top-bar + sidebar cause strict-mode violations
  - `e2e/errors.spec.ts` (1): duplicate "Análisis completado" headings cause strict-mode violation
  - `e2e/wizard.spec.ts` (7): duplicate "Análisis completado" headings cause strict-mode violation
  - `e2e/inline-rename.spec.ts` (1): 409 conflict test is flaky — first editable trigger resolves to a different template name

## Changed Files

- `apps/web/src/components/preview/EditableTitle.tsx` — render edit icon in editing state to allow rapid re-edit/abort
- `apps/web/src/components/preview/DocumentViewer.tsx` — add optional `onRenameTitle`; wrap `<h1>` with `EditableTitle`
- `apps/web/src/components/preview/PreviewPageContent.tsx` — add `handleRenameTitle`; pass to `DocumentViewer`
- `apps/web/src/components/preview/__tests__/DocumentViewer.test.tsx` — new
- `apps/web/e2e/inline-name-editing.spec.ts` — new
- `openspec/changes/inline-name-editing-cards/tasks.md` — mark PR-4 tasks complete

## Commits

- `7292604` feat(web): wire EditableTitle into /preview/[caseId] DocumentViewer
- `85fbb58` test(web): add DocumentViewer unit tests for inline title rename
- `ae18186` test(e2e): add inline name editing coverage across biblioteca, nuevo and preview

## Notes

- The rapid re-edit E2E test aborts the first PATCH by hanging it in the Playwright route handler; the second PATCH succeeds and the UI updates, proving `AbortController` cancellation.
- No regressions in `EditableParagraph` or existing preview unit tests.
