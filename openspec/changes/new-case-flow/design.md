# Design: new-case-flow

## Technical Approach

End-to-end legal document generation: user selects a template → fills dynamic form → AI generates document → previews/edits → exports PDF/DOCX. Backend adds a `casos` table, 6 REST endpoints, and a `DocumentGenerationService`. Frontend adds 2 routes with independent `CaseProvider` state (not `WizardContext`). Maps to 5 new capabilities (`case-management`, `document-generation`, `case-form-rendering`, `case-document-preview`, `case-export`) and 2 modified capabilities (`shared-contracts`, `template-library-page`). See specs for full requirement matrix.

## Architecture Decisions

| Decision | Choice | Alternatives | Rationale |
|----------|--------|-------------|-----------|
| AI generation mode | Synchronous request/response | BullMQ async + polling | MVP scope; 10–30s wait acceptable behind p21 loading screen. BullMQ adds infrastructure for marginal UX gain. |
| State management | `CaseProvider` (local `useReducer`) | Reuse `WizardContext` | Linear flow (form→preview→export), no multi-step state machine. WizardContext imports unrelated state (extractedText, analysis). |
| Export location | Client-side (`jspdf` + `docx`) | Server-side (Puppeteer/pdfkit) | Avoids 200+MB Docker bloat. Quality sufficient for structured text. Migration path contained. |
| Base text source | JOIN at generation time | Store on templates | Avoids denormalization + backfill. Graceful degradation when NULL. |
| Form grouping | `Entity.group` as accordion key | Hardcode section names | Already in schema, zero new design, scales to new template types. |
| Case status | `borrador→generado→exportado\|archivado` | Soft-delete flag | CHECK constraint enforces transitions. Mirrors user mental model. |
| Verification | Static 3-section manual checklist | AI-powered verification | Faster, cheaper, more reliable for MVP. AI verification deferred. |
| PDF font | Source Serif 4 (design system body) | System fonts | Matches DESIGN.md tokens. Embedded via jspdf `addFileToVFS`. |

## Data Flow

```
┌─────────────┐     ┌──────────────┐     ┌──────────────────┐
│  Biblioteca  │────→│ /nuevo/[id]  │────→│  POST /api/cases │
│  /biblio/[id]│     │  CaseForm    │     │  (create case)   │
└─────────────┘     └──────┬───────┘     └────────┬─────────┘
                           │                       │
                    ┌──────▼───────┐     ┌────────▼─────────┐
                    │ PATCH /cases │◄────│  Auto-save 30s   │
                    │ (form_data)  │     │  + manual save   │
                    └──────────────┘     └──────────────────┘
                           │
                    ┌──────▼───────┐     ┌──────────────────┐
                    │ POST /cases/ │────→│ DocumentGeneration│
                    │ :id/generate │     │ Service           │
                    └──────┬───────┘     │  ├─ TemplatesRepo │
                           │             │  ├─ CasesRepo     │
                    ┌──────▼───────┐     │  └─ OpenRouter    │
                    │ /preview/[id]│     └──────────────────┘
                    │  DocViewer   │
                    │  Checklist   │
                    │  ExportPanel │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │ jspdf / docx │
                    │ (client-side)│
                    └──────────────┘
```

## Database Design

### Migration: `0009_casos.sql`

```sql
CREATE TABLE IF NOT EXISTS casos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  template_id UUID NOT NULL REFERENCES templates(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'borrador',
  form_data JSONB NOT NULL DEFAULT '{}',
  generated_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT casos_status_allowed
    CHECK (status IN ('borrador', 'generado', 'exportado', 'archivado'))
);

CREATE INDEX IF NOT EXISTS casos_user_id_idx ON casos (user_id);
CREATE INDEX IF NOT EXISTS casos_template_id_idx ON casos (template_id);
CREATE INDEX IF NOT EXISTS casos_user_created_at_idx ON casos (user_id, created_at DESC);

-- RLS policies (mirror templates pattern)
ALTER TABLE casos ENABLE ROW LEVEL SECURITY;

CREATE POLICY casos_insert ON casos FOR INSERT
  WITH CHECK (user_id = current_setting('app.current_user_id')::BIGINT);
CREATE POLICY casos_select ON casos FOR SELECT
  USING (user_id = current_setting('app.current_user_id')::BIGINT);
CREATE POLICY casos_update ON casos FOR UPDATE
  USING (user_id = current_setting('app.current_user_id')::BIGINT);
CREATE POLICY casos_delete ON casos FOR DELETE
  USING (user_id = current_setting('app.current_user_id')::BIGINT);
```

### Entity Relationship

```
users (1)──(N) casos (N)──(1) templates (1)──(1) documents (1)──(N) analysis_results
```

`form_data` shape: `Record<Entity.id, string>` — flat key→value. No `base_text` column — derived via `template.document_id → analysis_results.extracted_text`.

## API Design

### New module: `apps/api/src/cases/`

| Method | Path | Request | Response | Status |
|--------|------|---------|----------|--------|
| `GET` | `/api/cases` | `?status=borrador` (optional) | `Case[]` (no `generated_text`) | 200, 401 |
| `POST` | `/api/cases` | `{ templateId: uuid }` | `Case` (status=`borrador`) | 201, 400, 401, 404 |
| `GET` | `/api/cases/:id` | — | `CaseWithTemplate` | 200, 401, 404 |
| `PATCH` | `/api/cases/:id` | `{ formData?, status? }` | `Case` | 200, 400, 401, 404, 409 |
| `POST` | `/api/cases/:id/generate` | — | `Case` (status=`generado`) | 200, 401, 404, 409, 422, 502 |
| `GET` | `/api/templates/:id/extracted-text` | — | `{ extractedText: string\|null }` | 200, 401, 404 |

### Validation

All requests validated with Zod at controller boundary via inline `safeParse` (existing pattern from `TemplatesController`). New schemas in `packages/contracts/src/schemas.ts`:

```typescript
export const CaseStatus = z.enum(["borrador", "generado", "exportado", "archivado"]);
export const CaseSchema = z.object({
  id: z.string().uuid(),
  userId: z.number(),
  templateId: z.string().uuid(),
  status: CaseStatus,
  formData: z.record(z.string(), z.string()),
  generatedText: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export const CreateCaseRequestSchema = z.object({ templateId: z.string().uuid() });
export const UpdateCaseFormDataSchema = z.object({
  formData: z.record(z.string(), z.string()).optional(),
  status: CaseStatus.optional(),
});
export const GenerateDocumentResponseSchema = z.object({
  generatedText: z.string().min(1),
});
export const ExportRequestSchema = z.object({ format: z.enum(["pdf", "docx"]) });
```

### Error mapping

| Error code | HTTP | When |
|-----------|------|------|
| Template not found | 404 | `POST /cases` with invalid templateId |
| Case not found | 404 | Any `/cases/:id` with missing/foreign case |
| Case locked | 409 | `PATCH` on `generado`/`archivado` case |
| AI generation failed | 422 | OpenRouter INVALID_RESPONSE after retries |
| OpenRouter unavailable | 502 | NETWORK_ERROR after retries |

## AI Generation Service

### File: `apps/api/src/ai/document-generation.service.ts`

Injected with `OpenRouterService`. Reuses existing OpenAI client, error class, and fallback chain.

**Prompt construction**:
- **System message** (~150 tokens): Role instructions + rules (preserve structure, substitute only provided values, use `[COMPLETAR: <field>]` for missing critical fields, respond as `{ generatedText: "..." }`).
- **User message**: Concatenation of template entities (id, label, group, value from form_data) + base `extracted_text` (if available).

**OpenRouter config**:
- `response_format: { type: "json_schema", json_schema: { name: "generated_document", schema: { generatedText: string } } }`
- `max_tokens: 16384` (new `AI_GENERATION_MAX_TOKENS` in `config/ai.ts`)
- `temperature: 0.3` (new `AI_GENERATION_TEMPERATURE`)

**Retry strategy**: 3 attempts with exponential backoff (1s, 3s) on `RATE_LIMIT`, `NETWORK_ERROR`, `INVALID_RESPONSE`. Mirrors `DocumentAnalysisService.callAiWithRetry`.

**Fallback when base text is NULL**: System message adjusts to "generate from entities and form data only". Response includes `baseTextMissing: true` flag. Frontend shows warning banner.

**Output validation**: `GenerateDocumentResponseSchema.safeParse()` on the parsed JSON. On failure after retries → 422.

## Frontend Architecture

### Routes

| Route | Page | Wrapper | Initial load |
|-------|------|---------|-------------|
| `/nuevo/[templateId]` | `NuevoCasoPage` | `AppShell` + `CaseProvider` | `GET /templates/:id` → `POST /cases` → render form |
| `/preview/[caseId]` | `PreviewPage` | `AppShell` + `CaseProvider` | `GET /cases/:id` → render viewer |

### State: `CaseProvider` (independent of `WizardContext`)

```typescript
interface CaseState {
  case: Case | null;
  template: Template | null;
  status: "idle" | "saving" | "generating" | "exporting";
  error: string | null;
}
type CaseAction =
  | { type: "SET_CASE"; payload: Case }
  | { type: "SET_TEMPLATE"; payload: Template }
  | { type: "SET_STATUS"; payload: CaseState["status"] }
  | { type: "SET_ERROR"; payload: string | null };
```

### Component tree

```
NuevoCasoPage
├── NewCaseLayout (2-col grid)
│   ├── CaseProgress (left rail: template info, X/Y fields, %)
│   └── CaseForm (main area)
│       └── CaseFormSection × N (accordion per Entity.group)
│           └── FieldRenderer × M (text|date|number|checkbox)
└── CaseStickyBar (bottom: "Guardar borrador" + "Generar documento")

PreviewPage
├── DocumentViewer (paragraphs)
│   └── EditableParagraph × N (click → contenteditable)
├── VerificationChecklist (right sidebar: 3 sections)
├── ExportPanel (PDF/DOCX buttons + metadata)
└── ExportSpinner (overlay during export)
```

### Key component props

```typescript
interface CaseFormSectionProps {
  group: Entity["group"];
  entities: Entity[];
  values: Record<string, string>;
  onChange: (entityId: string, value: string) => void;
  errors: Record<string, string>;
}

interface FieldRendererProps {
  entity: Entity;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  fieldType: "text" | "date" | "number" | "checkbox";
}

interface EditableParagraphProps {
  text: string;
  index: number;
  onSave: (index: number, newText: string) => void;
}

interface ExportPanelProps {
  caseId: string;
  templateSlug: string;
  generatedText: string;
  onExportComplete: () => void;
}
```

### Auto-save strategy

`useEffect` with 30s interval timer. Fires `PATCH /api/cases/:id` with current `react-hook-form` values. Only fires if `isDirty`. Manual "Guardar borrador" forces immediate save. No localStorage — API is the source of truth.

### Field type inference

```typescript
function inferFieldType(label: string): "text" | "date" | "number" | "checkbox" {
  const l = label.toLowerCase();
  if (/fecha|date/.test(l)) return "date";
  if (/monto|valor|precio|amount|price/.test(l)) return "number";
  if (/acepta|conforme|accept/.test(l)) return "checkbox";
  return "text";
}
```

## Export Architecture

### PDF pipeline (`jspdf`)

1. Split `generated_text` by `\n\n` into paragraphs
2. Initialize `jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })`
3. Embed Source Serif 4 via `addFileToVFS` + `addFont` (from DESIGN.md body font)
4. Iterate paragraphs: `text(paragraph, x, y, { maxWidth: 170, align: "justify" })`
5. Auto page-break at `y > 270mm`
6. `doc.save(filename)`

### DOCX pipeline (`docx` npm)

1. Split `generated_text` by `\n\n`
2. Build `Document({ sections: [{ children: paragraphs.map(p => new Paragraph({ text: p, alignment: "JUSTIFIED" })) }] })`
3. `Packer.toBlob(doc)` → `saveAs(blob, filename)`

### Filename convention

`${template.slug}-${case.id.slice(0, 8)}.${ext}` — e.g., `contrato-arrendamiento-a1b2c3d4.pdf`

### Export state machine

```
idle → exporting → success → PATCH status='exportado'
                  → error → show inline error, re-enable buttons
```

## Sequence Diagrams

### Template selection → form load

```
User → /biblioteca/[id] → click "Crear nuevo caso"
  → navigate /nuevo/[templateId]
  → GET /api/templates/:id → Template (entities)
  → POST /api/cases { templateId } → Case (borrador, empty form_data)
  → CaseProvider dispatches SET_CASE + SET_TEMPLATE
  → CaseForm groups entities by group → renders accordion sections
```

### Form fill → save draft

```
User fills fields → react-hook-form tracks dirty state
  → 30s timer fires → PATCH /api/cases/:id { formData }
  → CaseProvider status: 'saving' → 'idle'
  → OR: User clicks "Guardar borrador" → immediate PATCH
```

### Generate document → preview

```
User clicks "Generar documento" (disabled until ≥80% fields filled)
  → CaseProvider status: 'generating'
  → POST /api/cases/:id/generate
  → CasesService fetches template.entities + form_data + analysis_results.extracted_text
  → DocumentGenerationService builds prompt → OpenRouter call (10-30s)
  → Response validated → casos.generated_text updated, status='generado'
  → navigate /preview/[caseId]
  → GET /api/cases/:id → CaseWithTemplate
  → DocumentViewer splits generated_text → renders paragraphs
```

### Edit paragraph → save

```
User clicks paragraph → contenteditable mode
  → User edits text → clicks "Guardar"
  → Reconstruct full text from paragraph array
  → PATCH /api/cases/:id { generatedText: newText } (via formData or dedicated field)
```

### Export PDF/DOCX

```
User clicks "Exportar PDF" → ExportSpinner activates, buttons disabled
  → jspdf generates PDF blob from generated_text
  → URL.createObjectURL → anchor click → download
  → PATCH /api/cases/:id { status: 'exportado' }
  → Spinner dismisses, buttons re-enable
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `apps/api/src/infrastructure/postgres/migrations/0009_casos.sql` | Create | Table + RLS + indexes |
| `packages/contracts/src/schemas.ts` | Modify | Add CaseStatus, CaseSchema, CreateCaseRequest, UpdateCaseFormData, GenerateDocumentResponse, ExportRequest |
| `packages/contracts/src/index.ts` | Modify | Export new schemas + types |
| `apps/api/src/cases/cases.module.ts` | Create | NestJS module: imports DatabaseModule + AiModule |
| `apps/api/src/cases/cases.controller.ts` | Create | 5 endpoints with Zod validation |
| `apps/api/src/cases/cases.service.ts` | Create | Business logic: CRUD + generation orchestration |
| `apps/api/src/infrastructure/postgres/repositories/cases.repository.ts` | Create | RLS-scoped CRUD via PoolClient |
| `apps/api/src/ai/document-generation.service.ts` | Create | Prompt construction + OpenRouter call + retry |
| `apps/api/src/ai/ai.module.ts` | Modify | Register DocumentGenerationService |
| `apps/api/src/templates/templates.controller.ts` | Modify | Add `GET /:id/extracted-text` |
| `apps/api/src/config/ai.ts` | Modify | Add AI_GENERATION_MAX_TOKENS (16384), AI_GENERATION_TEMPERATURE (0.3) |
| `apps/api/src/app.module.ts` | Modify | Import CasesModule |
| `apps/web/src/app/nuevo/[templateId]/page.tsx` | Create | New-case route page |
| `apps/web/src/app/preview/[caseId]/page.tsx` | Create | Preview route page |
| `apps/web/src/lib/case/CaseContext.tsx` | Create | CaseProvider + useCase hook |
| `apps/web/src/lib/api/cases.ts` | Create | API client wrappers |
| `apps/web/src/components/new-case/NewCaseLayout.tsx` | Create | 2-column grid layout |
| `apps/web/src/components/new-case/CaseForm.tsx` | Create | Dynamic form orchestrator |
| `apps/web/src/components/new-case/CaseFormSection.tsx` | Create | Accordion section per group |
| `apps/web/src/components/new-case/FieldRenderer.tsx` | Create | Field type renderer |
| `apps/web/src/components/new-case/CaseProgress.tsx` | Create | Left rail progress |
| `apps/web/src/components/new-case/CaseStickyBar.tsx` | Create | Bottom sticky actions |
| `apps/web/src/components/preview/DocumentViewer.tsx` | Create | Paragraph renderer |
| `apps/web/src/components/preview/EditableParagraph.tsx` | Create | Inline edit component |
| `apps/web/src/components/preview/VerificationChecklist.tsx` | Create | 3-section checklist |
| `apps/web/src/components/preview/ExportPanel.tsx` | Create | Export buttons + metadata |
| `apps/web/src/components/preview/ExportSpinner.tsx` | Create | Export loading state |
| `apps/web/src/components/preview/BottomStickyBar.tsx` | Create | Reusable sticky bar |
| `apps/web/src/app/biblioteca/[id]/page.tsx` | Modify | Add "Crear nuevo caso" CTA |
| `apps/web/package.json` | Modify | Add `jspdf@^2.5`, `docx@^8.5` |

**Summary**: 20 new files, 10 modified files, 0 deleted.

## Testing Strategy

| Layer | What | Approach | Command |
|-------|------|----------|---------|
| Unit | Zod schemas (parse/reject) | Vitest | `pnpm --filter @template-ai/contracts test` |
| Unit | CasesService (mock repo) | Vitest | `pnpm --filter @template-ai/api test` |
| Unit | DocumentGenerationService (mock OpenRouter) | Vitest | `pnpm --filter @template-ai/api test` |
| Unit | Form grouping logic, field type inference | Vitest | `pnpm --filter @template-ai/web test` |
| Unit | Export utilities (mocked blob) | Vitest | `pnpm --filter @template-ai/web test` |
| Integration | CasesController e2e (Zod, RLS, 401/404/409/422) | Vitest + supertest | `pnpm --filter @template-ai/api test` |
| E2E | Happy path: form → generate → preview → export | Playwright | `pnpm --filter @template-ai/web test:e2e` |
| E2E | RLS isolation: two user contexts | Playwright | `pnpm --filter @template-ai/web test:e2e` |

## PR Chain Architecture

```
feature/new-case-flow (tracker, draft, no-merge)
  ← PR #1: feature/new-case-flow-pr1-contracts-db     ~150 lines
       ← PR #2: feature/new-case-flow-pr2-api-ai       ~350 lines
            ← PR #3: feature/new-case-flow-pr3-form-ui  ~380 lines
                 ← PR #4: feature/new-case-flow-pr4-preview-export ~380 lines
```

| PR | Scope | Key files | Est. lines |
|----|-------|-----------|-----------|
| #1 | Migration + Zod schemas | `0009_casos.sql`, `schemas.ts`, `index.ts` | ~150 |
| #2 | CasesModule + Controller + Service + Repository + DocumentGenerationService + config | `cases/*`, `document-generation.service.ts`, `ai.ts`, `app.module.ts` | ~350 |
| #3 | `/nuevo/[templateId]` + form components + CaseProvider + API client | `nuevo/*`, `new-case/*`, `CaseContext.tsx`, `cases.ts` | ~380 |
| #4 | `/preview/[caseId]` + preview components + export + biblioteca CTA | `preview/*`, `preview/*`, `biblioteca/[id]/page.tsx`, `package.json` | ~380 |

**400-line budget risk**: Medium. PRs #2–#4 approach 380 lines. If exceeded, split PR #4 into #4a (viewer + checklist) and #4b (export + CTA).

## Migration / Rollout

1. Apply migration `0009_casos.sql` (idempotent, `IF NOT EXISTS`)
2. Deploy API with `CasesModule` (new endpoints, no impact on existing routes)
3. Deploy web with new routes (entry point via modified `/biblioteca/[id]`)
4. No feature flag needed — routes not linked from nav until step 3

**Rollback**: `DROP TABLE casos CASCADE` + revert PRs in reverse order.

## Open Questions

- [ ] Should `PATCH /api/cases/:id` accept `generatedText` for paragraph edits, or should we add a dedicated `PATCH /api/cases/:id/paragraphs` endpoint?
- [ ] Source Serif 4 font embedding in jspdf: need to verify bundle size impact (estimated ~80KB for regular weight)
- [ ] Should repeatable entities (PARTES "Agregar parte") be in MVP or deferred? Spec says SHOULD, not MUST.
