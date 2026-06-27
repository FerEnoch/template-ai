# Proposal: new-case-flow

## Intent

template-ai currently lets users **create templates** (upload document → AI extracts entities → user reviews → save to library) but provides **no way to USE those templates to generate new documents**. The library is read-only storage. The product's core value — "save a contract structure once, generate new contracts from it forever" — is unreachable today. This change closes that loop: a user selects a template from the library, fills in case-specific data (parties, dates, property), gets an AI-generated legal document, and exports it as PDF or DOCX. Without it, template-ai is a tool that builds inventories of unused templates.

## Scope

### In Scope
- New `casos` table (Postgres + RLS) for persisting case state, form data, and generated text
- 6 new REST endpoints under `/api/cases` plus one new `/api/templates/:id/extracted-text`
- `DocumentGenerationService` — new OpenRouter call that takes template structure + user data + base text and returns a full document
- Two new frontend routes (`/nuevo/[templateId]`, `/preview/[caseId]`) with independent `CaseProvider` state (no `WizardContext` dependency)
- Dynamic accordion form rendered from template entities, grouped by `Entity.group` (PARTES, INMUEBLE, FECHAS, ANEXOS)
- Document preview with editable paragraphs, verification checklist, and export panel
- Client-side PDF/DOCX export (`jspdf`, `docx` npm package) as MVP; server-side fallback path is a tracked risk
- Entry point from `Biblioteca` detail page (`/biblioteca/[id]`) — "Crear nuevo caso" button → `/nuevo/[templateId]`

### Out of Scope
- Server-side PDF generation (deferred; tracked as a follow-up risk if client-side quality is insufficient)
- BullMQ async generation queue (synchronous with loading screen is enough for MVP; p21 design covers the waiting state)
- Document chunking for very long base texts (deferred; token-limit risk tracked)
- Editing saved cases after generation (cases are write-once for MVP; `archivado` state is the final form)
- Multi-tenant / shared case collaboration (single-user ownership only — matches `account-ownership` spec)
- Email / webhook notifications on generation completion
- DOCX template styling (`.docx` generation will use sensible defaults; no custom corporate template support)

## Capabilities

> Contract for `sdd-spec`. Existing capabilities referenced by directory name in `openspec/specs/`.

### New Capabilities
- `case-management` — Case CRUD, status lifecycle (`borrador → generado → exportado | archivado`), form-data persistence, listing with status filter
- `document-generation` — AI service that consumes template entities + user form data + base extracted text and produces full document text via OpenRouter
- `case-form-rendering` — Dynamic React form rendered from `Template.entities[]`, grouped by `Entity.group` into accordion sections, with sticky progress bar and draft save
- `case-document-preview` — Read-only document viewer with per-paragraph inline editing, verification checklist sidebar, and "Regenerar" / "Volver al formulario" actions
- `case-export` — Frontend PDF (jspdf) and DOCX (`docx` npm) export pipeline, including the loading state, error recovery, and filename conventions

### Modified Capabilities
- `shared-contracts` — Add `CaseSchema`, `CreateCaseRequestSchema`, `UpdateCaseFormDataSchema`, `GenerateDocumentRequestSchema`, `GenerateDocumentResponseSchema`, `CaseStatus` enum. No changes to existing `Entity` / `Template` / `AnalysisResult` schemas.
- `template-library-page` — Detail page (`/biblioteca/[id]`) MUST add a primary "Crear nuevo caso" CTA that navigates to `/nuevo/[templateId]`. The grid view on `/biblioteca` MAY also surface a secondary "Nuevo caso" action per card.

## Approach

**Backend** (apps/api): Standard NestJS module pattern. `cases.module.ts` registers `CasesController`, `CasesService`, and a `CasesRepository` instantiated inside `PostgresService.withOwnerTransaction` for RLS enforcement. `DocumentGenerationService` lives in `apps/api/src/ai/` next to `OpenRouterService` and reuses the existing client + `OpenRouterError` class. New `AI_GENERATION_MAX_TOKENS` (16384) and `AI_GENERATION_TEMPERATURE` (0.3) added to `apps/api/src/config/ai.ts`. Generation is **synchronous** in the request/response cycle — frontend shows the p21 loading screen. No BullMQ queue for MVP.

**Frontend** (apps/web): Two new pages under `apps/web/src/app/`. Each wraps its content in `CaseProvider` (a small `useReducer` context, NOT `WizardContext`). Forms use `react-hook-form` + `zodResolver` with the new shared contracts. Reuse `AppShell` (TopBar/Sidebar/Footer) and all `DESIGN.md` tokens. Form components live in `apps/web/src/components/new-case/`, preview components in `apps/web/src/components/preview/`. No new design system changes.

**AI flow**: Frontend posts to `POST /api/cases/:id/generate`. Service fetches `template.document_id → analysis_results.extracted_text` (nullable — graceful degradation if absent), builds the prompt (system message + entities + user data + base text), calls OpenRouter with `json_schema` response mode returning `{ generatedText: string }`, validates with Zod, persists to `casos.generated_text`, sets status to `generado`. The frontend then navigates to `/preview/[caseId]`.

**Export**: Two client-side libraries — `jspdf` for PDF (paragraph text, page breaks, basic styling) and `docx` (the npm package) for DOCX (rich structure with headings, paragraphs, lists). Both triggered from `ExportPanel`. A loading state (`ExportSpinner`) disables buttons during generation. Filename convention: `{template-slug}-{case-id-prefix}.{ext}`.

## User Flow

1. **Library entry** — User opens `/biblioteca`, clicks a template card → `/biblioteca/[id]`
2. **CTA** — Detail page shows template metadata + entity preview + "Crear nuevo caso" button
3. **Create case** — Clicking CTA navigates to `/nuevo/[templateId]`. Frontend calls `POST /api/cases { templateId }`, gets a new case in `borrador` status with empty form data
4. **Fill form** — Form renders sections grouped by `Entity.group` (PARTES, INMUEBLE, FECHAS, ANEXOS). User expands accordion sections, fills inputs. Auto-save fires every 30s via `PATCH /api/cases/:id`. Manual "Guardar borrador" button forces save.
5. **Generate** — User clicks "Generar documento" in sticky bottom bar. Frontend calls `POST /api/cases/:id/generate`. UI shows full-screen loading state (p21 variant: spinner + "Generando documento legal..." + elapsed timer). On success, status becomes `generado`, frontend navigates to `/preview/[caseId]`.
6. **Preview & edit** — Document renders in `DocumentViewer`. Each paragraph is clickable → contenteditable inline edit. Verification checklist on the right shows three sections (estructura, datos, fechas) with checkmarks. "Regenerar" button re-triggers generation. "Volver al formulario" returns to `/nuevo/[templateId]` (case stays in `borrador` if user wants to retry after edits).
7. **Export** — User clicks "Exportar PDF" or "Exportar DOCX" in `ExportPanel`. `ExportSpinner` activates. On completion, browser downloads file. Status transitions to `exportado`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `apps/api/src/cases/` | New | `cases.module.ts`, `cases.controller.ts`, `cases.service.ts` — full NestJS module |
| `apps/api/src/infrastructure/postgres/repositories/cases.repository.ts` | New | Repository with RLS-scoped CRUD via `withOwnerTransaction` |
| `apps/api/src/ai/document-generation.service.ts` | New | OpenRouter generation call, prompt construction, response validation |
| `apps/api/src/templates/templates.controller.ts` | Modified | Add `GET /api/templates/:id/extracted-text` endpoint |
| `apps/api/src/config/ai.ts` | Modified | Add `AI_GENERATION_MAX_TOKENS` (16384) and `AI_GENERATION_TEMPERATURE` (0.3) |
| `apps/api/src/app.module.ts` | Modified | Register `CasesModule` |
| `apps/api/migrations/0009_casos.sql` | New | Table + RLS policies + indexes |
| `packages/contracts/src/schemas.ts` | Modified | Add Case, CreateCase, GenerateRequest, GenerateResponse, CaseStatus schemas |
| `apps/web/src/app/nuevo/[templateId]/page.tsx` | New | New-case route — fetches template, creates case, renders form |
| `apps/web/src/app/preview/[caseId]/page.tsx` | New | Preview route — fetches case + generated text, renders viewer |
| `apps/web/src/components/new-case/` | New | `NewCaseLayout`, `CaseForm`, `CaseFormSection`, `CaseProgress`, `CaseStickyBar` |
| `apps/web/src/components/preview/` | New | `DocumentViewer`, `VerificationChecklist`, `ExportPanel`, `ExportSpinner` |
| `apps/web/src/lib/case/CaseContext.tsx` | New | `CaseProvider` + `useCase` hook (independent of `WizardContext`) |
| `apps/web/src/app/biblioteca/[id]/page.tsx` | Modified | Add "Crear nuevo caso" CTA |
| `apps/web/src/lib/api/cases.ts` | New | API client wrappers for the 6 case endpoints |
| `apps/web/package.json` | Modified | Add `jspdf` and `docx` dependencies |
| `apps/api/package.json` | Modified | No new deps — reuses existing `openai` + `zod` |

## Architecture Decisions

| Decision | Choice | Why | Alternative considered |
|---|---|---|---|
| AI generation location | **Synchronous in API request** | MVP scope, simpler error handling, the 10–30s wait is acceptable behind a loading screen (p21 design). No BullMQ queue setup. | BullMQ async + polling — rejected for MVP; adds infrastructure for marginal UX gain |
| State management | **`CaseProvider` (local `useReducer`), NOT `WizardContext`** | New flow is linear (form → preview → export), has no multi-step state machine, and the case id is the source of truth. Reusing `WizardContext` would import unrelated state (extractedText, analysis result) and require restructuring `client-layout.tsx`. | Reuse `WizardContext` — rejected; context boundary already proven wasteful in exploration Gap 7 |
| Export location | **Client-side first (`jspdf` + `docx`)** | Avoids server-side PDF library (Puppeteer, pdfkit) which adds 200+ MB to Docker images. Quality is good enough for the structured text we generate. Migration path to server-side is a contained refactor. | Server-side PDF from day one — rejected; over-engineering for MVP |
| Base text source | **Fetched at generation time via JOIN to `analysis_results.extracted_text`** | Templates don't store text; the doc→analysis link is the canonical source. Avoids duplicating data. Graceful degradation: if `extracted_text IS NULL`, generation proceeds with entities + form data only (lower quality, user sees warning). | Store base text on templates — rejected; denormalization, requires backfill migration |
| Form grouping | **Use `Entity.group` as the accordion section key** | Already in the schema, already populated by analysis. Zero new design required. Stable across templates. | Hardcode section names — rejected; brittle, doesn't scale to new template types |
| Case status enum | **`borrador`, `generado`, `exportado`, `archivado`** | Mirrors user mental model. CHECK constraint enforces valid transitions. `archivado` reserved for future "delete" without losing data. | Soft-delete via flag — rejected; status enum is clearer in queries and UI |
| Verification checklist | **Static 3-section checklist (estructura, datos, fechas), no AI** | User-driven review is faster and more reliable than a second AI pass for MVP. Future enhancement: AI-powered completeness scoring. | Auto-verify with AI — rejected; doubles cost, marginal value at MVP |

## Database Schema

New table `casos` (migration `0009_casos.sql`):

```sql
CREATE TABLE casos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  template_id UUID NOT NULL REFERENCES templates(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'borrador',
  form_data JSONB NOT NULL DEFAULT '{}',
  generated_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT casos_status_allowed CHECK (status IN ('borrador', 'generado', 'exportado', 'archivado'))
);

CREATE INDEX casos_user_id_idx ON casos (user_id);
CREATE INDEX casos_template_id_idx ON casos (template_id);
CREATE INDEX casos_user_created_at_idx ON casos (user_id, created_at DESC);
```

**RLS policies** mirror the `templates` table pattern — `user_id` column direct, `app.current_user_id` setting for INSERT/SELECT/UPDATE/DELETE policy predicates.

**`form_data` shape**: `Record<Entity.id, string>` — flat key→value map keyed by entity id. Group info is implicit via the template's entity list.

**No `base_text` column** — derived at generation time from `template.document_id → analysis_results.extracted_text`.

## API Design

| Method | Path | Request | Response | Errors |
|---|---|---|---|---|
| `GET` | `/api/cases` | query: `?status=borrador` (optional) | `Case[]` (metadata only — no `generated_text`) | 401 |
| `POST` | `/api/cases` | `{ templateId: uuid }` | `Case` (full, empty form_data, status=`borrador`) | 400, 401, 404 (template not found) |
| `GET` | `/api/cases/:id` | — | `CaseWithTemplate` (case + template entities + status + generated_text) | 401, 404 |
| `PATCH` | `/api/cases/:id` | `{ formData: Record<string, string> }` | `Case` (updated) | 400 (invalid form data), 401, 404, 409 (case already `generado` — locked) |
| `POST` | `/api/cases/:id/generate` | — | `Case` with `status=generado`, `generated_text` populated | 401, 404, 409 (case `archived`), 422 (AI generation failed), 502 (OpenRouter unavailable) |
| `GET` | `/api/templates/:id/extracted-text` | — | `{ extractedText: string \| null }` | 401, 404 |

**Schemas** (added to `shared-contracts`): `CaseStatus` enum, `CaseSchema`, `CreateCaseRequestSchema`, `UpdateCaseFormDataSchema`, `GenerateDocumentRequestSchema` (empty body, validates path param), `GenerateDocumentResponseSchema`. All requests/responses validated with Zod at the controller boundary via `ZodValidationPipe` (existing pattern).

## Frontend Architecture

**Routes** (Next.js App Router):

| Route | Page | Wrapped by | Initial load |
|---|---|---|---|
| `/nuevo/[templateId]` | `NuevoCasoPage` | `AppShell` + `CaseProvider` | `GET /api/templates/:id` → `POST /api/cases` → render form |
| `/preview/[caseId]` | `PreviewPage` | `AppShell` + `CaseProvider` | `GET /api/cases/:id` (with template join) → render viewer |

**State**: `CaseProvider` exposes `{ case, template, status: 'idle'\|'saving'\|'generating', dispatch }`. No cross-page state; navigation is one-directional and case is re-fetched by id. `react-hook-form` manages form fields; `CaseProvider` only tracks high-level state.

**Components** (in `apps/web/src/components/new-case/` and `apps/web/src/components/preview/`):
- `NewCaseLayout` — two-column grid: left rail (`CaseProgress`) + main accordion
- `CaseForm` — orchestrator that groups `template.entities` by `Entity.group` and renders `CaseFormSection` per group
- `CaseFormSection` — single accordion section with `Entity`-keyed inputs (text, date, number inferred from label heuristics)
- `CaseProgress` — left rail with template name, entity count, completion progress, "X de Y campos completados"
- `CaseStickyBar` — bottom sticky bar with "Guardar borrador" (primary) and "Generar documento" (primary, disabled until ≥80% required fields filled)
- `DocumentViewer` — paragraph-by-paragraph rendering of `generated_text` with `contenteditable` per paragraph on click; "Guardar cambios" button on edit mode
- `VerificationChecklist` — right sidebar with 3 collapsible sections (Estructura, Datos, Fechas), each with a manual check
- `ExportPanel` — left sidebar (or bottom section) with PDF/DOCX buttons, case metadata, legal disclaimer
- `ExportSpinner` — full-card loading state matching p21 design

**Routing guards**: `/nuevo/[templateId]` redirects to `/biblioteca` if template id is invalid. `/preview/[caseId]` redirects to `/biblioteca` if case is `archivado` or doesn't belong to current user.

## AI Generation Strategy

**Prompt structure** (system message, ~150 tokens):

```
Eres un asistente especializado en generación de documentos legales. Se te proporcionará:
1. La estructura de la plantilla (entidades extraídas del documento original)
2. Los datos completados por el usuario para cada campo
3. El texto base del documento original (puede ser parcial o ausente)

Tu tarea es generar el documento final sustituyendo los datos en la plantilla con los
valores proporcionados, preservando el formato, estilo y estructura legal del documento
base. El resultado debe ser un documento legal completo y profesional listo para revisión.

Reglas:
- Conserva la estructura de secciones, cláusulas y formato del documento base
- Sustituye ÚNICAMENTE los valores de las entidades provistas; no inventes datos faltantes
- Si un campo crítico está vacío, usa el placeholder "[COMPLETAR: <nombre del campo>]"
- Mantén el tono formal legal apropiado

Responde EXCLUSIVAMENTE con un JSON: { "generatedText": "texto completo del documento" }
```

**User message**: Concatenates `template.entities` (id, label, group, value from form_data), the user-filled `formData`, and (if present) the base `extractedText` from the template's document analysis.

**OpenRouter config**:
- `response_format: { type: "json_schema", json_schema: <generatedText schema> }` — strict mode
- `max_tokens: AI_GENERATION_MAX_TOKENS` (16384)
- `temperature: AI_GENERATION_TEMPERATURE` (0.3)
- Reuses existing model from `AI_CONFIG.model` and fallback chain
- Retries on `RATE_LIMIT`, `NETWORK_ERROR`, `INVALID_RESPONSE` per `ai-error-resilience` spec (3 attempts)

**Output validation**: `GenerateDocumentResponseSchema` enforces `{ generatedText: string }` shape. On `INVALID_RESPONSE` after retries, the endpoint returns 422 to the frontend, which surfaces an inline error on the form (user can retry or edit form data).

**Graceful degradation**: If `extracted_text IS NULL` for the template's document, the system message becomes "No base text available — generate from entities and form data only" and the user is warned via a banner on the preview page ("Documento generado sin texto base — revise con atención").

## Export Strategy

| Format | Library | Why | Limitations |
|---|---|---|---|
| PDF | `jspdf` v2 | Pure JS, no server dep, ~50KB gzipped. Supports text wrapping, page breaks, font embedding. | Complex layouts (tables, multi-column) require manual positioning. Acceptable for our generated text. |
| DOCX | `docx` v8 (npm) | Same author as docxtemplater; produces valid OOXML. Supports headings, paragraphs, lists, basic styling. | No headers/footers in MVP; can be added later without API change. |

**Export flow**:
1. User clicks "Exportar PDF" in `ExportPanel`
2. `ExportSpinner` activates (disables both buttons, shows progress)
3. Function calls `jspdf` or `docx` library with `case.generated_text`
4. Blob is created, `URL.createObjectURL` is invoked, anchor click triggers download
5. Filename: `${template.slug}-${case.id.slice(0, 8)}.${ext}`
6. On success: `PATCH /api/cases/:id` with `{ status: 'exportado' }`, dismiss spinner
7. On error: spinner shows inline error, buttons re-enable

**Fallback plan**: If PDF quality is insufficient (reviewable post-MVP via user feedback or QA), migration to server-side is contained:
- Add `apps/api/src/export/` module
- New endpoint `POST /api/cases/:id/export` returning PDF blob
- Swap `ExportPanel` to fetch + download
- Use `pdfkit` or `puppeteer-core` (with shared Chromium in Docker)
- No breaking changes to `case-export` capability contract

## Migration Plan

**Migration `0009_casos.sql`** is the only DB change. It is fully additive — no existing tables, columns, indexes, RLS policies, or seed data are altered. Down-migration: `DROP TABLE casos CASCADE;` (cascades to RLS policies). No data backfill needed (table starts empty).

**Forward compatibility**: Existing data is untouched. Existing `template`, `analysis_results`, `documents`, `users` tables are referenced via foreign keys only.

**Deploy order**:
1. Apply migration (idempotent; uses `IF NOT EXISTS` for table and indexes)
2. Deploy API with new `CasesModule` (new endpoints, no impact on existing routes)
3. Deploy web with new routes (new URLs, no impact on existing wizard or library)
4. No feature flag needed — routes are not linked from existing nav until ready (entry point lives in the modified `/biblioteca/[id]` page, deployed in step 3)

## PR Chain Breakdown

**Strategy**: Feature Branch Chain (`feature/new-case-flow` tracker → 4 child PRs)

```
feature/new-case-flow (tracker, draft, no-merge)
  ← PR #1: Database + Contracts          (targets tracker)  ~150 lines
       ← PR #2: API Layer + AI Service     (targets #1)       ~350 lines
            ← PR #3: New-Case Form UI       (targets #2)       ~380 lines
                 ← PR #4: Preview + Export   (targets #3)       ~380 lines
```

| PR | Scope | Files | Review focus |
|---|---|---|---|
| **#1** Database + Contracts | Migration `0009_casos.sql` (table + RLS + indexes); add 5 Zod schemas to `packages/contracts/src/schemas.ts`; export from `index.ts` | `0009_casos.sql`, `packages/contracts/src/schemas.ts`, `packages/contracts/src/index.ts` | RLS policy correctness, schema field types, status enum values |
| **#2** API Layer + AI Service | `CasesModule`, `CasesController`, `CasesService`, `CasesRepository`; `DocumentGenerationService`; `TemplatesController` extended with extracted-text endpoint; `app.module.ts` updated; `ai.ts` config additions | `apps/api/src/cases/`, `apps/api/src/ai/document-generation.service.ts`, `apps/api/src/templates/templates.controller.ts`, `apps/api/src/config/ai.ts`, `apps/api/src/app.module.ts` | RLS isolation, Zod request validation, OpenRouter prompt construction, error mapping to HTTP codes |
| **#3** New-Case Form UI | `NuevoCasoPage`, all new-case components (`NewCaseLayout`, `CaseForm`, `CaseFormSection`, `CaseProgress`, `CaseStickyBar`); `CaseContext` provider; `/api/cases` client wrappers; form validation; draft auto-save; sticky bar with "Generar documento" | `apps/web/src/app/nuevo/[templateId]/page.tsx`, `apps/web/src/components/new-case/`, `apps/web/src/lib/case/CaseContext.tsx`, `apps/web/src/lib/api/cases.ts` | Independent state from wizard, accordion UX, validation rules, auto-save debounce, navigation guard |
| **#4** Preview + Export | `PreviewPage`, `DocumentViewer`, `VerificationChecklist`, `ExportPanel`, `ExportSpinner`; install `jspdf` + `docx`; export pipeline; status transition to `exportado`; modified `/biblioteca/[id]` page with "Crear nuevo caso" CTA | `apps/web/src/app/preview/[caseId]/page.tsx`, `apps/web/src/components/preview/`, `apps/web/src/app/biblioteca/[id]/page.tsx`, `apps/web/package.json` | Paragraph edit UX, export library error handling, filename convention, status transition on export |

**Estimated total**: ~1,260 changed lines across 4 PRs. **400-line budget risk**: Medium. PRs #2, #3, #4 each approach 380 lines. If any PR exceeds 400, the natural split is **PR #4a** (DocumentViewer + VerificationChecklist) and **PR #4b** (ExportPanel + ExportSpinner + biblioteca CTA change).

**Test strategy per PR**:
- PR #1: Vitest on contracts (schema parse + reject), SQL migration tested via `compose.test.yaml` apply
- PR #2: Vitest on `CasesService` (mock repository) + `CasesController` e2e (Zod validation, RLS isolation, 401/404/422 paths), `DocumentGenerationService` unit tests with mocked OpenRouter
- PR #3: Vitest on form components (grouping logic, validation, sticky bar enabled state), Playwright happy-path (fill form → save draft → reload → submit)
- PR #4: Vitest on export utility (mocked blob), Playwright full-flow (form → generate → preview → export both formats)

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| **AI hallucinates or misses field substitutions** | Med | p17-style inline error banner on preview when AI flags uncertainty; verification checklist forces user review; "Regenerar" button available without re-entering form data |
| **Long documents exceed OpenRouter token limits** | Low | 16384 max_tokens covers ~12K words. Track in `usage_ledger` with operation type `generacion_documento` (already defined). If templates approach limit, defer chunking to follow-up. |
| **Template has no `extracted_text`** (legacy templates, pre-0006 or failed OCR) | Med | Graceful degradation: generate from entities + form data only, show warning banner on preview, "Regenerar" after manual base text upload (future enhancement) |
| **Client-side PDF quality insufficient for complex layouts** | Med | MVP accept quality for plain text output. Track user feedback. Fallback path: server-side via `pdfkit` or `puppeteer-core` in a contained refactor. No contract changes needed. |
| **`WizardContext` wrapping conflict in `client-layout.tsx`** | Low | `CaseProvider` is independent — wizard context just provides state that isn't consumed by the new routes. No restructure needed. Verified in exploration Gap 7. |
| **Synchronous generation blocks API worker for 10–30s** | Low | Acceptable for MVP with the loading screen. If load increases, migrate to BullMQ (already configured in `app.module.ts`). Each `/generate` call is idempotent via case status. |
| **Form data shape evolves and breaks saved cases** | Low | `form_data` is `JSONB`; UI renders based on **current** template entities, not saved data. Stale fields are ignored on preview. No migration needed for new entities. |
| **`/preview/[caseId]` URL accessible after `archivado`** | Low | Page-level guard redirects to `/biblioteca` if status is `archivado` or case is missing/foreign |
| **PDF filename collisions** | Low | Filename includes `case.id.slice(0, 8)` — collision probability ~negligible for a single user. Tracked in error logs. |
| **Export panel reveals PII in generated text** | Med | Document content is user-generated; legal disclaimer in `ExportPanel` reminds users to redact sensitive data. No automated redaction in MVP. |

## Rollback Plan

| Stage | Action |
|---|---|
| **PR #1 only deployed** | Run `down` migration: `DROP TABLE casos CASCADE;`. Revert PR. Zero user impact (no UI surfaces the table yet). |
| **PRs #1-2 deployed** | API endpoints exist but no UI calls them. Safe to remove `CasesModule` import in `app.module.ts` and revert files. |
| **PRs #1-3 deployed** | New routes exist but no `/biblioteca/[id]` CTA. Users cannot reach them. Hide routes via feature flag (or revert PR #3). Migration stays — no data loss. |
| **All 4 PRs deployed (full feature)** | Revert last PR for partial rollback, or: (1) run `down` migration, (2) revert all 4 PRs in order, (3) restart API and web. User-created cases are lost. If the feature has been used, communicate the data loss via release notes. **Recommendation**: keep a backup of `casos` table before rollback. |
| **AI generation quality emergency** | Disable `POST /api/cases/:id/generate` via env flag (`CASES_GENERATION_ENABLED=false`); existing cases still loadable, just cannot generate new ones. Toggle is a single config change. |

## Dependencies

- **External libs (frontend)**: `jspdf@^2.5`, `docx@^8.5` — both MIT-licensed, widely used, no native deps
- **External libs (backend)**: None new — reuses `openai` (OpenRouter client) and `zod`
- **Internal**: `OpenRouterService` (existing), `PostgresService` (existing), `WizardContext` (NOT consumed but wraps routes — safe per exploration)
- **Database**: Postgres 15+ (current), RLS extension (current)
- **No new infrastructure** — no Redis queue, no Chromium, no headless browser

## Success Criteria

- [ ] User can navigate from `/biblioteca/[id]` to `/nuevo/[templateId]` via "Crear nuevo caso" CTA
- [ ] Form renders sections grouped by `Entity.group` for any saved template
- [ ] Draft auto-saves every 30s; manual save button works; reload preserves form data
- [ ] "Generar documento" triggers API call; loading screen appears within 200ms; result returned within 30s for templates under 5K words
- [ ] Generated text appears in `/preview/[caseId]` with paragraph-level inline edit
- [ ] Verification checklist can be toggled; state persists in component memory (not persisted to DB for MVP)
- [ ] "Exportar PDF" downloads a valid PDF; "Exportar DOCX" downloads a valid DOCX; both open in standard readers
- [ ] After export, case status transitions to `exportado` and reflects on the next visit
- [ ] RLS isolation: a user cannot read, update, or generate another user's case (verified by e2e test with two user contexts)
- [ ] All 4 PRs merged, CI green, e2e happy path (form → generate → preview → export both formats) passes
- [ ] No regression in existing wizard flow, library page, or analysis pipeline
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm format` all pass
- [ ] Vitest coverage on new code ≥80% (api + web)
- [ ] `CaseProvider` does not import or depend on `WizardContext` (verified by `madge` or equivalent)
- [ ] `jspdf` and `docx` bundle size increase on the preview route ≤ 150KB gzipped (verified by `next build` output)
