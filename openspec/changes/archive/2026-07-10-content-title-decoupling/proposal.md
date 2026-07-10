# Proposal: Content Title Decoupling & Lowercase Export Fix

## Intent

Two defects on `/preview/[id]` export: (1) PDF/DOCX titles render all-lowercase because `slugify()` lowercases the name and that slug is reused as the document title; (2) display name is conflated with content title — no way to show "Compraventa-inmobiliaria-Gómez-Morvan" on the card while the document's internal heading reads "Compraventa". This fixes the lowercase bug and adds an independent `contentTitle` field.

## Scope

### In Scope
- PR-5 (frontend-only): rename `templateSlug`→`filenameSlug` in `ExportPanel`; add `displayTitle` prop; use `displayTitle` for PDF/DOCX title, `filenameSlug` for `buildFilename()`.
- PR-6 (full stack): `content_title` column (migration 0012); `CaseSchema`/`UpdateCaseFormDataSchema` gain `contentTitle`; `CaseResponse` + repository + `PATCH /api/cases/:id`; second `EditableTitle` on `/preview/[id]`; export resolves `displayTitle = contentTitle ?? name ?? template.name`.

### Out of Scope
- AI-generated title metadata in `generatedText` (title stays user-authored).
- Backfill of existing cases (NULL fallback covers them).
- Export formats beyond PDF/DOCX in `exporters.ts`.

## Capabilities

> Contract between proposal and specs. sdd-spec reads this to know which specs to create/update.

### New Capabilities
- `content-title-decoupling`: `content_title` field lifecycle — storage, contract, API read/write, fallback resolution `contentTitle ?? name ?? template.name`, and independent editing UI on `/preview/[id]` distinct from the display name.

### Modified Capabilities
- `document-preview`: `ExportPanel` MUST accept `filenameSlug` and `displayTitle` separately and use `displayTitle` as the PDF/DOCX document title; `filenameSlug` used only for filenames.
- `shared-contracts`: `CaseSchema` and `UpdateCaseFormDataSchema` MUST include optional nullable `contentTitle`.

## Approach

PR-5 first as an isolated low-risk fix: separates filename from display concerns in two frontend files, immediately restoring correct casing. PR-6 layers the full decoupling: add nullable `content_title`, thread through contracts/API, give `/preview/[id]` TWO independent editable titles — display name (from PR-4) and a new content-title `EditableTitle`. Export always prefers `contentTitle`, falling back to `name` then `template.name`, so NULL cases render unchanged.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `apps/web/.../preview/ExportPanel.tsx` | Modified | `templateSlug`→`filenameSlug` + `displayTitle` |
| `apps/web/.../preview/PreviewPageContent.tsx` | Modified | Separate `displayTitle`/`filenameSlug`; second `EditableTitle` |
| `packages/contracts/src/schemas.ts` | Modified | Add `contentTitle` to case schemas |
| `apps/api/src/cases/*` + repository | Modified | `CaseResponse`, read/write, PATCH accepts `contentTitle` |
| `apps/api/.../migrations/0012_casos_content_title.sql` | New | `ALTER TABLE casos ADD COLUMN content_title TEXT NULL` |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Migration on existing POC data | Low | Nullable column, no backfill; fallback chain preserves old behavior |
| Export regression casing | Med | PR-5 lands first with its own tests; PR-6 reuses `displayTitle` path |
| Two `EditableTitle` instances collide on `/preview/[id]` | Med | Distinct props/keys; clear save targets (name vs contentTitle) |

## Rollback Plan

Revert PR-6 migration via `ALTER TABLE casos DROP COLUMN content_title`; revert both PRs to restore the `templateSlug` path. No data loss — `content_title` is additive and nullable.

## Dependencies

- Completed `inline-name-editing-cards` PRs 1–4 (display-name `EditableTitle` on `/preview/[id]`).

## Success Criteria

- [ ] PDF/DOCX from `/preview/[id]` preserve original casing in the document title.
- [ ] Content title editable and persisted independently from display name.
- [ ] NULL `contentTitle` falls back to `name` then `template.name` in exports.
- [ ] `pnpm typecheck`, API + web Vitest, Playwright e2e pass.
