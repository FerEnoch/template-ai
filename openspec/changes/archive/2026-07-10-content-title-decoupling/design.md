# Design: Content Title Decoupling & Lowercase Export Fix

## Technical Approach

**PR-5** (frontend-only): split filename from display title in `ExportPanel` — rename `templateSlug`→`filenameSlug`, add `displayTitle`; PDF/DOCX heading uses `displayTitle`, `buildFilename()` uses `filenameSlug`. `PreviewPageContent` passes `displayTitle={name ?? template.name}`, `filenameSlug={slugify(name ?? template.name)}`. Restores casing immediately, no backend.

**PR-6**: add nullable `content_title` (migration **0015** — 0012/0013/0014 already exist), thread through repository/contracts/API, compute `effectiveTitle = contentTitle ?? name ?? template.name` once in `mapToResponse`, expose on `CaseResponse`, add a SECOND `EditableTitle` on `/preview/[id]` (below the display-name h1, label "Título del documento") editing `contentTitle` independently. Export switches to `effectiveTitle` / `slugify(effectiveTitle)`.

## Architecture Decisions

| Decision | Options | Tradeoff | Choice |
|---|---|---|---|
| Fallback resolution location | API vs frontend | API = single source of truth, no duplicated chain | **API** `mapToResponse` |
| `effectiveTitle` typing | In contracts CaseSchema vs frontend-local type | In schema = derived field pollutes entity + breaks fixtures; local type = clean separation | **Frontend-local** `CaseWithTemplateResponse extends CaseWithTemplate` |
| Migration number | 0012 (proposal) vs 0015 | 0012–0014 already exist | **0015_casos_content_title.sql** |
| contentTitle editor placement | DocumentViewer vs PreviewPageContent | "Below h1" lives in DocumentViewer `<article>` | **DocumentViewer** new props |
| Editor value when null | raw `?? ""` vs `?? fallback` | raw keeps null=unset; fallback pre-fills input | **raw** value; children shows fallback muted |
| Backend update path | Dedicated `updateContentTitle` vs fold into updateFormData | Dedicated mirrors `updateName` (no unique constraint) | **Dedicated** repo+service method |

## Component Tree — /preview/[id]

**Before (post-PR-4):**
```
DocumentViewer
└── h1 EditableTitle (display name)              [onRenameTitle]
```
**After (PR-6):**
```
DocumentViewer
├── h1 EditableTitle (display name)              [onRenameTitle]        ← unchanged, separate instance
└── "Título del documento" EditableTitle          [onRenameContentTitle] ← NEW
```

## Data Flow

```
casos.content_title ─▶ CaseRecord.contentTitle ─▶ mapToResponse ─▶ CaseResponse { contentTitle, effectiveTitle }
                                                                        │
  PATCH /api/cases/:id { contentTitle } ◀── EditableTitle onSave ───────┤
                                                                        ▼
PreviewPageContent ─{ displayTitle=effectiveTitle, filenameSlug=slugify(effectiveTitle) }─▶ ExportPanel
                                                                                          │
                                                                  PDF/DOCX heading = displayTitle
                                                                  filename            = filenameSlug
```

## File Changes

**PR-5 (frontend-only):**
| File | Action | Description |
|---|---|---|
| `apps/web/src/components/preview/ExportPanel.tsx` | Modify | `templateSlug`→`filenameSlug`; add `displayTitle`; pass as `title` to `generatePdf`/`generateDocx`; `filenameSlug` to `buildFilename` |
| `apps/web/src/components/preview/PreviewPageContent.tsx` | Modify | Pass `filenameSlug` + `displayTitle` separately (frontend fallback `name ?? template.name`) |

**PR-6 (full stack):**
| File | Action | Description |
|---|---|---|
| `apps/api/src/infrastructure/postgres/migrations/0015_casos_content_title.sql` | Create | `ALTER TABLE casos ADD COLUMN IF NOT EXISTS content_title TEXT NULL` |
| `apps/api/src/infrastructure/postgres/repositories/cases.repository.ts` | Modify | `CaseRecord.contentTitle`; add `c.content_title` to `CASE_SELECT`; `rowToCase` maps it; add `updateContentTitle()` (mirrors `updateName`) |
| `apps/api/src/cases/cases.service.ts` | Modify | `CaseResponse` + `UpdateCaseData` += `contentTitle`; `mapToResponse` computes `effectiveTitle`; add `updateContentTitle()` |
| `apps/api/src/cases/cases.controller.ts` | Modify | PATCH branch: `contentTitle !== undefined` → `updateContentTitle` |
| `packages/contracts/src/schemas.ts` | Modify | `CaseSchema` += `contentTitle: z.string().nullable().optional()`; `UpdateCaseFormDataSchema` += `contentTitle` |
| `packages/contracts/src/__tests__/case.test.ts`, `schemas.test.ts` | Modify | Add contentTitle null/missing/string cases (optional → no existing fixture breakage) |
| `apps/web/src/lib/api/cases.ts` | Modify | Add `CaseWithTemplateResponse extends CaseWithTemplate { contentTitle: string\|null; effectiveTitle: string }`; `fetchCase` returns it |
| `apps/web/src/components/preview/DocumentViewer.tsx` | Modify | Add `contentTitle?`, `onRenameContentTitle?`, `contentTitleFallback?`; render 2nd `EditableTitle` below h1 |
| `apps/web/src/components/preview/PreviewPageContent.tsx` | Modify | `handleRenameContentTitle`→`updateCase(id,{contentTitle},signal)`; pass `effectiveTitle` to export + content-title props to DocumentViewer |

## Migration SQL

```sql
-- 0015_casos_content_title.sql
ALTER TABLE casos ADD COLUMN IF NOT EXISTS content_title TEXT NULL;
-- No backfill; no RLS change (existing casos_update policy covers the new column, as in 0011).
```

## Interfaces / Contracts

```ts
// packages/contracts
CaseSchema += { contentTitle: z.string().nullable().optional() }
UpdateCaseFormDataSchema += { contentTitle: z.string().nullable().optional() }

// apps/api cases.service
interface CaseResponse { /* existing */; contentTitle: string | null; effectiveTitle: string }
interface UpdateCaseData { /* existing */; contentTitle?: string | null }

// apps/web lib/api/cases
interface CaseWithTemplateResponse extends CaseWithTemplate {
  contentTitle: string | null;
  effectiveTitle: string;
}

// apps/web DocumentViewer (extends existing props)
contentTitle?: string | null
onRenameContentTitle?: (value: string, signal?: AbortSignal) => Promise<void>
contentTitleFallback?: string

// apps/web ExportPanel
filenameSlug: string   // was templateSlug
displayTitle: string   // NEW
```

## Testing Strategy

| Layer | What | Approach |
|---|---|---|
| Unit (contracts) | contentTitle null/missing/string accepted | Vitest fixtures |
| Unit (api) | `mapToResponse` effectiveTitle chain (3 levels); `updateContentTitle` repo+service; PATCH routes contentTitle | Vitest + mocks |
| Unit (web) | ExportPanel: `displayTitle`→title, `filenameSlug`→filename; DocumentViewer 2nd EditableTitle; renameContentTitle PATCHes contentTitle; display name unaffected | RTL + mocked `updateCase` |
| E2E | /preview edit content title → export PDF heading reflects it; display name unchanged | Playwright |

> Config `strict_tdd: true` → apply phase writes tests first (RED-GREEN).

## Migration / Rollout

Additive nullable column, no backfill. Rollback: `ALTER TABLE casos DROP COLUMN content_title`. Revert both PRs to restore the `templateSlug` path. No data loss — `content_title` is additive/nullable.

## Open Questions

- [ ] **BLOCKER — PR-4 code absent from HEAD**: `EditableTitle`, `useInlineEdit`, `DocumentViewer.onRenameTitle`, and `updateCase(id, data, signal?)` exist ONLY in git history (commits `1a9a717`, `7292604`) — NOT ancestors of current `feature/inline-name-editing` HEAD. The `inline-name-editing-cards` openspec change is archived as complete, but its code was never merged to this branch. PR-6 REUSES these artifacts; they MUST exist at apply time (merge PR-4 code first, or reintroduce). Verified via `git merge-base --is-ancestor` — not an assumption.
- [ ] contentTitle cannot be cleared to null via the 3-200 inline editor (same constraint as display name). Accepted per scope; a "clear" action is out of scope.
- [ ] Migration renumbered 0012→0015 (proposal predates 0012–0014).
