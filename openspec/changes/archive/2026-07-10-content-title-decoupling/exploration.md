# Exploration: Title Decoupling & Lowercase Bug

**Status**: success

## Executive Summary

Two issues found sharing the same root cause: `slugify()` in `exporters.ts` lowercases the display name, and that slugified value is reused as both the filename slug AND the document content title in PDF/DOCX exports. Fixing the lowercase bug requires separating `filenameSlug` from `displayTitle` in ExportPanel (2 files). Full title decoupling requires adding a `content_title` column to the DB, updating contracts/schemas, exposing it via API, and adding UI to edit it independently from the display name.

## Section A: Lowercase Bug

### Root Cause

`apps/web/src/lib/export/exporters.ts:5` — `slugify()` calls `.toLowerCase()`. The result is passed as the `title` param to `generatePdf()` and `generateDocx()`.

### Causality Chain
1. `PreviewPageContent.tsx:210`: `templateSlug={slugify(caseItem.name ?? caseItem.template.name)}` → "compraventa-inmobiliaria-gomez-morvan"
2. `ExportPanel.tsx:39-40`: passes `templateSlug` as `title` to PDF/DOCX
3. `pdf.ts` / `docx.ts`: renders lowercased title as document heading

### Fix (2 files, no backend)
- Rename `templateSlug` → `filenameSlug` in ExportPanel props
- Add `displayTitle` prop with the original (non-slugified) name
- Use `displayTitle` for PDF/DOCX title, `filenameSlug` for `buildFilename()`

## Section B: Title Decoupling

### Current State
- `casos` table has `name TEXT NULL` (migration 0011) but NO `content_title` column
- `CaseSchema` has no `contentTitle` field
- `generatedText` (AI output) contains body text only, no title metadata
- Display name IS the document title — no separation exists

### Required Changes (Approach A — Full Decoupling)

**Database:**
- New migration: `ALTER TABLE casos ADD COLUMN content_title TEXT NULL`

**Contracts:**
- `CaseSchema`: add `contentTitle: z.string().nullable().optional()`
- `UpdateCaseFormDataSchema`: add `contentTitle: z.string().nullable().optional()`

**API:**
- `CaseResponse` interface: add `contentTitle: string | null`
- Repository: read/write `content_title` column
- `PATCH /api/cases/:id`: accept `contentTitle` in body

**Frontend:**
- `PreviewPageContent`: pass `contentTitle ?? name` as document title to ExportPanel
- `/preview/[id]`: add EditableTitle for content title (separate from display name)
- `ExportPanel`: use `displayTitle` (content title) for PDF/DOCX, not display name

## Files to Modify

| File | Change |
|------|--------|
| `apps/web/src/lib/export/exporters.ts` | No change needed (slugify stays for filenames) |
| `apps/web/src/components/preview/ExportPanel.tsx` | Replace `templateSlug` with `filenameSlug` + `displayTitle` |
| `apps/web/src/components/preview/PreviewPageContent.tsx` | Pass `displayTitle` and `filenameSlug` separately |
| `packages/contracts/src/schemas.ts` | Add `contentTitle` to CaseSchema and UpdateCaseFormDataSchema |
| `apps/api/src/cases/cases.service.ts` | Add `contentTitle` to CaseResponse |
| `apps/api/src/infrastructure/postgres/repositories/cases.repository.ts` | Read/write `content_title` |
| `apps/api/src/cases/cases.controller.ts` | Validate/accept `contentTitle` in PATCH body |

## Files to Create

| File | Change |
|------|--------|
| `apps/api/src/infrastructure/postgres/migrations/0012_casos_content_title.sql` | New migration |

## Next Phase

propose
