## Exploration: new-case-flow

### Executive Summary

The codebase has no existing "case" (caso) or document generation functionality beyond the `usage_ledger.generacion_documento` operation type in the initial schema. Templates store AI-extracted entities (fields) as JSONB but don't store the original document text directly — it lives in `analysis_results.extracted_text`, reachable via `templates.document_id`. The project has well-established patterns for API controllers (NestJS + Zod), database access (PostgresService.withOwnerTransaction + RLS), frontend forms (react-hook-form + zodResolver), and AI calls (OpenRouterService with json_schema mode). A new case flow requires: a `casos` table, 6 new API endpoints, 2 new frontend routes with independent state management (not wizard context), a document generation AI service, and frontend PDF/DOCX export.

### Gaps Identified

- **Gap 1 - No `casos` database table**: No persistence for user cases. Need a table with template reference, form data (JSONB), generated text, status, and timestamps. RLS ownership required.
- **Gap 2 - No document generation AI service**: OpenRouterService only extracts entities and classifies spans. Need a new method/prompt that generates full document text from a template structure + user-filled field values. Requires different system prompt, higher max_tokens, and different response format.
- **Gap 3 - Templates don't store base text**: The original document text (`extracted_text`) lives in `analysis_results` linked to documents, not directly on templates. Must traverse `template.document_id → analysis_results → extracted_text` to get the base text for AI generation.
- **Gap 4 - No frontend dynamic form rendering**: The current wizard shows entity preview with inline edits. The new case flow needs a form that renders fields dynamically based on template entities, organized by accordion sections (groups: PARTES, INMUEBLE, FECHAS, ANEXOS).
- **Gap 5 - No frontend export functionality**: No PDF or DOCX generation exists. Must implement client-side first (jspdf, docx npm) with server-side fallback if quality insufficient.
- **Gap 6 - No contracts (Zod schemas) for cases**: `packages/contracts` has no Case-related schemas. Need CaseSchema, CreateCaseSchema, CaseFieldSchema, GenerateRequestSchema, GenerateResponseSchema.
- **Gap 7 - No independent flow state management**: WizardContext wraps the entire app via client-layout.tsx. The new case flow must operate independently with its own state, but client-layout already wraps wizard. Need to ensure these don't conflict.
- **Gap 8 - Sidebar navigation doesn't link to new case flow directly**: The "Nuevo Documento" button links to `/upload?step=upload`. Bibliotecas entries should link to `/nuevo/[templateId]` when a user selects a template.

### Integration Points

- **AppShell** (`apps/web/src/components/shell/app-shell.tsx`): Reusable layout with TopBar, Sidebar, Footer. Already used by all pages. Accepts `activeSidebarItem` and `sidebar`/`footer` boolean props.
- **PostgresService.withOwnerTransaction** (`apps/api/src/infrastructure/postgres/postgres.service.ts`): Established pattern for RLS-scoped DB transactions. All new repository methods will follow this.
- **TemplatesRepository** (`apps/api/src/infrastructure/postgres/repositories/templates.repository.ts`): Existing pattern for repository classes — plain class instantiated within transaction, not DI-injected.
- **OpenRouterService** (`apps/api/src/ai/open-router.service.ts`): Established OpenAI client setup with OpenRouter base URL, API key, fallback model logic, and error handling. New generation method reuses this client.
- **OpenRouterService error handling** (`apps/api/src/ai/open-router.service.ts`): OpenRouterError class with typed error codes (AUTH_ERROR, MODEL_NOT_FOUND, RATE_LIMIT, INVALID_RESPONSE, NETWORK_ERROR). Should reuse for generation calls.
- **AI_CONFIG** (`apps/api/src/config/ai.ts`): Model, fallback, maxTokens, temperature configuration. Generation may need separate maxTokens (higher — up to 16384 for full documents).
- **react-hook-form + zodResolver pattern** (`apps/web/src/components/wizard/SaveForm.tsx`): Established form pattern. Dynamic form rendering for new case should follow this but render fields from template entities.
- **DESIGN.md design tokens** (`apps/web/src/app/globals.css`): CSS custom properties using Tailwind CSS 4 `@theme` directive. All new UI uses `--color-accent`, `--font-headline`, etc.
- **Template types and Zod schemas** (`packages/contracts/src/schemas.ts`): EntitySchema defines the field structure. Reuse `Entity` type for form field definitions.
- **API module pattern** (`apps/api/src/templates/templates.module.ts`): Standard NestJS module with controller + service + repository. New cases module follows same structure.
- **Biblioteca routing**: Existing `/biblioteca` page and `/biblioteca/[id]` detail page. The `[id]` detail page already has entity display. Can add "Crear nuevo caso" button there.

### Database Changes Needed

#### New table: `casos`

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

**Migration number**: `0009_casos.sql`

**RLS policies**: Same pattern as templates — direct `user_id` column with INSERT/SELECT/UPDATE/DELETE policies checking `current_setting('app.current_user_id')`.

**Notes**:
- `form_data` JSONB stores the user-filled values keyed by entity ID → value mapping
- `generated_text` is NULL until AI generation completes
- `status` transitions: borrador → generado → exportado (or → archivado)
- No separate `base_text` column needed — it's derived from `template.document_id → analysis_results.extracted_text` at generation time.

### API Endpoints Needed

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/cases` | List all cases for current user (supports `?status=borrador` filter) |
| `POST` | `/cases` | Create a new case from a template. Body: `{ templateId: string }`. Returns case with pre-populated fields from template entities. |
| `GET` | `/cases/:id` | Get full case: metadata + form_data + generated_text + template entities |
| `PATCH` | `/cases/:id` | Update form_data (partial save as draft). Body: `{ formData: Record<string, string> }` |
| `POST` | `/cases/:id/generate` | Trigger AI document generation. Returns `{ status: 'generando' }`. Async via BullMQ or synchronous with progress updates. |
| `GET` | `/templates/:id/extracted-text` | Get the base text from template's associated document's analysis. Used by frontend to pass to generation endpoint. |

**Controller**: `apps/api/src/cases/cases.controller.ts`  
**Service**: `apps/api/src/cases/cases.service.ts`  
**Repository**: `apps/api/src/infrastructure/postgres/repositories/cases.repository.ts`  
**Module**: `apps/api/src/cases/cases.module.ts` (registered in `app.module.ts`)

### Frontend Routes & Components Needed

#### Routes
| Route | Purpose | Page component |
|-------|---------|----------------|
| `/nuevo/[templateId]` | New Case form — dynamic fields from template entities, accordion layout, draft save | `apps/web/src/app/nuevo/[templateId]/page.tsx` |
| `/preview/[caseId]` | Preview + Export — generated document viewer, editable paragraphs, verification checklist, PDF/DOCX export | `apps/web/src/app/preview/[caseId]/page.tsx` |

#### Components
| Component | Path | Purpose |
|-----------|------|---------|
| `NewCaseLayout` | `apps/web/src/components/new-case/NewCaseLayout.tsx` | Two-column layout: left rail (template info + progress) + main form area (accordion sections) |
| `CaseForm` | `apps/web/src/components/new-case/CaseForm.tsx` | Dynamic form rendering from template entities grouped by `group` field. Uses react-hook-form. |
| `CaseFormSection` | `apps/web/src/components/new-case/CaseFormSection.tsx` | Accordion section per entity group (Partes, Inmueble, Fechas, Anexos) |
| `CaseProgress` | `apps/web/src/components/new-case/CaseProgress.tsx` | Left rail component showing template info, progress bar, status badge |
| `CaseStickyBar` | `apps/web/src/components/new-case/CaseStickyBar.tsx` | Bottom sticky bar with "Guardar borrador" and "Generar documento" buttons |
| `DocumentViewer` | `apps/web/src/components/preview/DocumentViewer.tsx` | Read-only document viewer with editable paragraph mode (inline edit) |
| `VerificationChecklist` | `apps/web/src/components/preview/VerificationChecklist.tsx` | Sidebar checklist: estructura, datos, fechas — all verified |
| `ExportPanel` | `apps/web/src/components/preview/ExportPanel.tsx` | Export module with PDF/DOCX buttons, metadata section, legal disclaimer |
| `ExportSpinner` | `apps/web/src/components/preview/ExportSpinner.tsx` | Loading state for export operations (spinner + disabled buttons) |

#### State Management
- **NOT using WizardContext**: The new case flow operates independently. Create a `CaseProvider` context in `apps/web/src/lib/case/CaseContext.tsx`.
- **Local state per page**: `useState` + `useCallback` for API calls, form state via react-hook-form.
- **No cross-page state needed**: Navigation is one-directional (new case → preview). Case data loaded from API by ID on each page.
- **Template data**: Fetched on `/nuevo/[templateId]` mount via `GET /api/templates/:id` — entities define the form fields.
- **Draft persistence**: `PATCH /api/cases/:id` on explicit "Guardar borrador" click + auto-save periodically.

### AI Integration Approach

#### How generation differs from extraction

| Aspect | Extraction (existing) | Generation (new) |
|--------|----------------------|-----------------|
| Input | Raw document text | Template entities + user-filled values + base text |
| Output | JSON array of entities | Full document text (string) |
| System prompt | "Extrae entidades clave del documento" | "Generá un documento legal completo..." |
| Response format | `json_schema` with strict entities array | Plain text (or `json_schema` with `generatedText` field) |
| Max tokens | 8192 | 16384 (documents can be long) |
| Temperature | 0.1 | 0.3 (allow some creativity while staying faithful to base) |
| Caching | Hash of input text | Not cached (user data varies) |

#### Prompt strategy

```
SYSTEM: Eres un asistente especializado en generación de documentos legales.
Se te proporcionará:
1. La estructura de la plantilla (entidades extraídas del documento original)
2. Los datos completados por el usuario para cada campo
3. El texto base del documento original

Tu tarea es generar el documento final reemplazando los datos de la plantilla
con los valores proporcionados, preservando el formato, estilo y estructura
legal del documento base. El resultado debe ser un documento legal completo
y profesional listo para revisión.

Responde EXCLUSIVAMENTE con un JSON: { "generatedText": "texto completo del documento" }
```

#### Service design
- New method `generateDocument()` on `OpenRouterService` or a new `DocumentGenerationService` in `apps/api/src/ai/`
- Reuses OpenRouter client, fallback model, and error handling from `OpenRouterService`
- Separate config for `AI_GENERATION_MAX_TOKENS` (default 16384)
- Not cached (user-specific data)
- Retryable on RATE_LIMIT and NETWORK_ERROR (following existing retry pattern)

### Risks & Unknowns

- **Risk 1 - AI generation quality**: The generation prompt must produce legally coherent text that correctly substitutes all fields. If the AI hallucinates or misses substitutions, the review step becomes critical. Consider implementing field-level validation on the output.
- **Risk 2 - Token limits for long documents**: Legal documents can be 10K+ words. The combined prompt (base text + entities + user data + generation response) may exceed OpenRouter token limits. Solution: Document chunking for very long templates (deferred to later iteration).
- **Risk 3 - Template entities may not have extracted_text**: If a template was created before migration 0006 or if text extraction failed, `extracted_text` is NULL. The generation would need only entities + form data in that case (reduced quality).
- **Risk 4 - Client-side PDF quality**: jspdf may produce subpar PDFs for complex legal formatting (multiple columns, specific line breaks, tables). Fallback to server-side generation using a headless browser or dedicated library might be needed.
- **Risk 5 - WizardContext wrapping conflict**: `client-layout.tsx` wraps `<WizardProvider>` around ALL children. New case routes that don't use wizard must still render within this context. It's safe (context just provides state that isn't consumed) but wasteful. Could restructure providers to be route-specific.
- **Risk 6 - Async generation UX**: If generation takes 10-30 seconds, the user needs clear progress indication. Option A: synchronous request with loading state. Option B: async with BullMQ + polling. For MVP, synchronous with loading screen (p21-export-en-curso design variant).
- **Unknown - BullMQ for generation**: The project has `@nestjs/bullmq` in `app.module.ts` but only the Redis connection is configured — no queues are registered yet. Adding a generation queue would require additional setup.

### PR Chain Forecast

**Strategy**: Feature Branch Chain (feature/new-case-flow tracker → child PRs)

The work splits naturally into 4 autonomous work units:

#### PR Chain

```
feature/new-case-flow (tracker, draft, no-merge)
  ← PR #1: Database + Contracts   (targets tracker)
       ← PR #2: API Layer           (targets PR#1)
            ← PR #3: Frontend Form    (targets PR#2)
                 ← PR #4: Preview + Export (targets PR#3)
```

| PR | Scope | Est. Lines | Key Files |
|----|-------|-----------|-----------|
| #1 | Migration 0009 (casos table) + Zod schemas in contracts | ~150 | `0009_casos.sql`, `schemas.ts` updates, `index.ts` exports |
| #2 | Cases module (controller, service, repository) + generation AI service + module registration | ~350 | `cases.controller.ts`, `cases.service.ts`, `cases.repository.ts`, `cases.module.ts`, `document-generation.service.ts`, `app.module.ts` |
| #3 | `/nuevo/[templateId]` route + all form components + CaseProvider + validation | ~380 | `nuevo/[templateId]/page.tsx`, `NewCaseLayout.tsx`, `CaseForm.tsx`, `CaseFormSection.tsx`, `CaseProgress.tsx`, `CaseStickyBar.tsx`, `CaseContext.tsx` |
| #4 | `/preview/[caseId]` route + DocumentViewer + Export (jspdf/docx) + VerificationChecklist | ~380 | `preview/[caseId]/page.tsx`, `DocumentViewer.tsx`, `VerificationChecklist.tsx`, `ExportPanel.tsx`, `ExportSpinner.tsx` |

**Total estimated**: ~1,260 changed lines across 4 PRs.

**400-line budget risk**: Medium — PRs #2, #3, #4 each approach but stay near the 400-line budget. If PR #3 or #4 exceeds, the form and preview components can each be split further.

**Decision needed before apply**: No — each PR is autonomous and reviewable in ≤60 min.

### Ready for Proposal

Yes. All gaps are clearly identified, integration points are concrete, and the PR chain forecast is within review budget. The orchestrator should proceed to `sdd-propose` with this exploration as input.

**What the orchestrator should tell the user**: "Exploración completa. La base de código está lista para el nuevo flujo de casos. Identifiqué 8 gaps, 10 puntos de integración con código existente, y un plan de 4 PRs encadenados que se mantiene cerca del presupuesto de 400 líneas por PR. ¿Procedo con la propuesta (sdd-propose)?"
