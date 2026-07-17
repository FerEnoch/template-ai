# Fix: Preview filename decoupling — revert content_title, show filename read-only

## Problem

PR-6 incorrectly introduced `content_title` as a DB column and separate editable field. The document title is **content**, not metadata — it lives in `generatedText` and gets edited like any paragraph via `EditableParagraph`. What was labeled "Título del documento" on /preview should actually be the **filename** (`name`), shown as read-only info.

PR-4 incorrectly made the display name editable on /preview via `EditableTitle`. The filename should be set in /biblioteca or /nuevo, not on the preview screen.

## Scope

1. **Revert PR-6 content_title**: remove migration 0015, column from repository/service/controller, contracts field, web API types, 2nd EditableTitle
2. **Fix /preview DocumentViewer**: remove EditableTitle for display name, show filename as read-only info text
3. **Keep PR-5**: ExportPanel filenameSlug/displayTitle separation stays
4. **Keep PRs 1-3**: biblioteca/nuevo inline editing stays

## Files affected

- `apps/api/src/infrastructure/postgres/migrations/0015_casos_content_title.sql` — DELETE
- `apps/api/src/infrastructure/postgres/repositories/cases.repository.ts` — remove contentTitle
- `apps/api/src/cases/cases.service.ts` — remove contentTitle, effectiveTitle, updateContentTitle
- `apps/api/src/cases/cases.controller.ts` — remove contentTitle PATCH branch
- `packages/contracts/src/schemas.ts` — remove contentTitle
- `apps/web/src/lib/api/cases.ts` — remove CaseWithTemplateResponse contentTitle/effectiveTitle
- `apps/web/src/components/preview/DocumentViewer.tsx` — remove EditableTitle, show name as read-only
- `apps/web/src/components/preview/PreviewPageContent.tsx` — remove handleRenameContentTitle, simplify
- Tests: update all test files to reflect changes
