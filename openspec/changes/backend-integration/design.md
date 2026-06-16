# Design: Backend Integration

## Technical Approach

Replace MSW browser mocks with real NestJS API endpoints backed by PostgreSQL. Create three NestJS modules (Documents, Analysis, Templates) following the existing DDD pattern established by `domain-schema-first/`. Add migration `0002_document_templates.sql` for persistent storage. Simulate AI analysis with DB-backed progress tracking — same API contract, drop-in AI replacement later. Wire frontend to API via Next.js rewrites proxy so relative `/api/*` paths work unchanged.

## Architecture Decisions

| Decision | Options | Choice | Rationale |
|----------|---------|--------|-----------|
| Entity storage | Inline JSONB vs separate table | **Separate `entities` table** | Review endpoint updates individual entities by ID; separate rows avoid full-result rewrites on each review |
| Template entities | JSONB column vs junction table | **JSONB `entities` on templates** | Templates are point-in-time snapshots, not live references; matches frontend `Template.entities: Entity[]` contract; no JOINs for reads |
| RLS on new tables | Skip vs full RLS | **RLS with user_id ownership** | Follows 0001 pattern; uses sentinel `ownerId=0` for POC; auth is a drop-in replacement |
| API prefix | `/api` in controller paths vs global prefix | **`app.setGlobalPrefix('api')`** | Clean controller decorators; single config point; matches frontend's `/api/*` convention |
| Analysis processing | Simulated vs real AI | **Simulated (Option A)** | Same response contract; DB-backed progress increments per poll; AI service swaps in without API changes |
| File storage | S3/local vs metadata-only | **Metadata-only for POC** | Accept multipart, extract filename/size/mimeType, discard bytes; storage layer added post-POC |
| Frontend→API routing | Direct `API_BASE_URL` vs Next.js proxy | **Next.js rewrites proxy** | Frontend keeps relative `/api/*` paths; single origin avoids CORS; no frontend fetch changes needed |
| Validation | Manual checks vs Zod from contracts | **Zod schemas from `@template-ai/contracts`** | Single source of truth; shared package already defines all shapes; parse in controller before service call |

## Data Flow

```
Browser ──→ Next.js :3000 ──rewrite──→ NestJS API :3001
                │                           │
                │  /api/* proxy             ├─ DocumentsController
                │                           │    └─ POST /upload → INSERT document + analysis_result
                │                           │
                │                           ├─ AnalysisController
                │                           │    ├─ GET /:id → SELECT result + entities, increment progress
                │                           │    └─ GET /:id/status → lightweight poll (status + progress only)
                │                           │
                │                           ├─ ReviewController
                │                           │    └─ POST /:docId/entities/:entityId → UPDATE entity row
                │                           │
                │                           └─ TemplatesController
                │                                ├─ GET / → SELECT templates (entities from JSONB)
                │                                └─ POST / → INSERT template (entities as JSONB snapshot)
                │
                └── All services use PostgresService.withOwnerTransaction(userId, cb)
```

**Upload → Analysis polling sequence:**

```
POST /api/documents/upload
  → INSERT documents (status='processing')
  → INSERT analysis_results (progress=0, status='processing')
  → RETURN Document { id, filename, mimeType, sizeBytes, status:'processing', uploadedAt }

GET /api/analysis/:id  (polled every 800ms by frontend)
  → SELECT analysis_results WHERE document_id = :id
  → IF status='processing': UPDATE progress = LEAST(progress + 25, 100)
  → IF progress >= 100:
      UPDATE status='completed', completed_at=now()
      INSERT INTO entities (sample entities for POC)
  → SELECT entities WHERE analysis_result_id = :resultId
  → RETURN AnalysisResult { documentId, status, entities[], progress, startedAt, completedAt? }
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `apps/api/src/infrastructure/postgres/migrations/0002_document_templates.sql` | Create | 4 tables + indexes + RLS policies |
| `apps/api/src/documents/documents.module.ts` | Create | NestJS module registration |
| `apps/api/src/documents/documents.controller.ts` | Create | `POST /upload` — multipart accept, metadata extract |
| `apps/api/src/documents/documents.service.ts` | Create | Upload logic, creates document + analysis_result |
| `apps/api/src/documents/documents.controller.spec.ts` | Create | TDD unit tests |
| `apps/api/src/documents/documents.service.spec.ts` | Create | TDD unit tests |
| `apps/api/src/analysis/analysis.module.ts` | Create | NestJS module registration |
| `apps/api/src/analysis/analysis.controller.ts` | Create | `GET /:id`, `GET /:id/status` |
| `apps/api/src/analysis/analysis.service.ts` | Create | Simulated progressive analysis with DB progress |
| `apps/api/src/analysis/analysis.controller.spec.ts` | Create | TDD unit tests |
| `apps/api/src/analysis/analysis.service.spec.ts` | Create | TDD unit tests |
| `apps/api/src/review/review.module.ts` | Create | NestJS module registration |
| `apps/api/src/review/review.controller.ts` | Create | `POST /:documentId/entities/:entityId` |
| `apps/api/src/review/review.service.ts` | Create | Entity update logic |
| `apps/api/src/review/review.controller.spec.ts` | Create | TDD unit tests |
| `apps/api/src/review/review.service.spec.ts` | Create | TDD unit tests |
| `apps/api/src/templates/templates.module.ts` | Create | NestJS module registration |
| `apps/api/src/templates/templates.controller.ts` | Create | `GET /`, `POST /` |
| `apps/api/src/templates/templates.service.ts` | Create | CRUD + duplicate name check (409) |
| `apps/api/src/templates/templates.controller.spec.ts` | Create | TDD unit tests |
| `apps/api/src/templates/templates.service.spec.ts` | Create | TDD unit tests |
| `apps/api/src/infrastructure/postgres/repositories/documents.repository.ts` | Create | CRUD for documents table |
| `apps/api/src/infrastructure/postgres/repositories/analysis-results.repository.ts` | Create | CRUD + progress update for analysis_results |
| `apps/api/src/infrastructure/postgres/repositories/entities.repository.ts` | Create | CRUD + bulk insert for entities |
| `apps/api/src/infrastructure/postgres/repositories/templates.repository.ts` | Create | CRUD + name uniqueness check |
| `apps/api/src/app.module.ts` | Modify | Import DocumentsModule, AnalysisModule, ReviewModule, TemplatesModule |
| `apps/api/src/main.ts` | Modify | Add `app.setGlobalPrefix('api')` + CORS config |
| `apps/api/src/config/env.ts` | Modify | Add `CORS_ORIGIN` env var |
| `apps/api/package.json` | Modify | Add `@types/multer` devDependency |
| `apps/web/next.config.ts` | Modify | Add rewrites: `/api/:path*` → `API_BASE_URL/api/:path*` |
| `apps/web/.env.local` | Modify | Set `NEXT_PUBLIC_MSW=false` |

## Database Schema (0002_document_templates.sql)

```sql
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'processing',
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT documents_status_allowed CHECK (
    status IN ('pending', 'processing', 'completed', 'failed')
  )
);

CREATE TABLE analysis_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'processing',
  progress INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  CONSTRAINT analysis_results_status_allowed CHECK (
    status IN ('pending', 'processing', 'completed', 'failed')
  ),
  CONSTRAINT analysis_results_progress_range CHECK (progress BETWEEN 0 AND 100)
);

CREATE TABLE entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_result_id UUID NOT NULL REFERENCES analysis_results(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  value TEXT NOT NULL,
  "group" TEXT NOT NULL,
  confidence TEXT NOT NULL,
  source_span JSONB,
  reviewed BOOLEAN NOT NULL DEFAULT false,
  excluded BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT entities_group_allowed CHECK ("group" IN ('PARTES', 'INMUEBLE', 'FECHAS', 'ANEXOS')),
  CONSTRAINT entities_confidence_allowed CHECK (confidence IN ('ALTA', 'MEDIA', 'BAJA'))
);

CREATE TABLE templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE RESTRICT,
  category TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  entities JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT templates_status_allowed CHECK (status IN ('draft', 'published', 'archived')),
  CONSTRAINT templates_name_unique_per_user UNIQUE (user_id, name)
);

CREATE INDEX documents_user_id_idx ON documents (user_id);
CREATE INDEX analysis_results_document_id_idx ON analysis_results (document_id);
CREATE INDEX entities_analysis_result_id_idx ON entities (analysis_result_id);
CREATE INDEX entities_document_id_idx ON entities (document_id);
CREATE INDEX templates_user_id_idx ON templates (user_id);

-- RLS: follow 0001 pattern — ownership via user_id = app.current_user_id
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents FORCE ROW LEVEL SECURITY;
ALTER TABLE analysis_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_results FORCE ROW LEVEL SECURITY;
ALTER TABLE entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE entities FORCE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates FORCE ROW LEVEL SECURITY;

-- documents: direct user_id column
CREATE POLICY documents_insert ON documents FOR INSERT WITH CHECK (
  current_setting('app.current_user_id', true) IS NOT NULL
  AND user_id = current_setting('app.current_user_id', true)::BIGINT
);
CREATE POLICY documents_select ON documents FOR SELECT USING (
  current_setting('app.current_user_id', true) IS NOT NULL
  AND user_id = current_setting('app.current_user_id', true)::BIGINT
);
CREATE POLICY documents_update ON documents FOR UPDATE USING (
  current_setting('app.current_user_id', true) IS NOT NULL
  AND user_id = current_setting('app.current_user_id', true)::BIGINT
);
CREATE POLICY documents_delete ON documents FOR DELETE USING (
  current_setting('app.current_user_id', true) IS NOT NULL
  AND user_id = current_setting('app.current_user_id', true)::BIGINT
);

-- analysis_results: ownership through documents.user_id
CREATE POLICY analysis_results_insert ON analysis_results FOR INSERT WITH CHECK (
  current_setting('app.current_user_id', true) IS NOT NULL
  AND document_id IN (
    SELECT id FROM documents WHERE user_id = current_setting('app.current_user_id', true)::BIGINT
  )
);
CREATE POLICY analysis_results_select ON analysis_results FOR SELECT USING (
  current_setting('app.current_user_id', true) IS NOT NULL
  AND document_id IN (
    SELECT id FROM documents WHERE user_id = current_setting('app.current_user_id', true)::BIGINT
  )
);
CREATE POLICY analysis_results_update ON analysis_results FOR UPDATE USING (
  current_setting('app.current_user_id', true) IS NOT NULL
  AND document_id IN (
    SELECT id FROM documents WHERE user_id = current_setting('app.current_user_id', true)::BIGINT
  )
);

-- entities: ownership through documents.user_id
CREATE POLICY entities_insert ON entities FOR INSERT WITH CHECK (
  current_setting('app.current_user_id', true) IS NOT NULL
  AND document_id IN (
    SELECT id FROM documents WHERE user_id = current_setting('app.current_user_id', true)::BIGINT
  )
);
CREATE POLICY entities_select ON entities FOR SELECT USING (
  current_setting('app.current_user_id', true) IS NOT NULL
  AND document_id IN (
    SELECT id FROM documents WHERE user_id = current_setting('app.current_user_id', true)::BIGINT
  )
);
CREATE POLICY entities_update ON entities FOR UPDATE USING (
  current_setting('app.current_user_id', true) IS NOT NULL
  AND document_id IN (
    SELECT id FROM documents WHERE user_id = current_setting('app.current_user_id', true)::BIGINT
  )
);

-- templates: direct user_id column
CREATE POLICY templates_insert ON templates FOR INSERT WITH CHECK (
  current_setting('app.current_user_id', true) IS NOT NULL
  AND user_id = current_setting('app.current_user_id', true)::BIGINT
);
CREATE POLICY templates_select ON templates FOR SELECT USING (
  current_setting('app.current_user_id', true) IS NOT NULL
  AND user_id = current_setting('app.current_user_id', true)::BIGINT
);
CREATE POLICY templates_update ON templates FOR UPDATE USING (
  current_setting('app.current_user_id', true) IS NOT NULL
  AND user_id = current_setting('app.current_user_id', true)::BIGINT
);
CREATE POLICY templates_delete ON templates FOR DELETE USING (
  current_setting('app.current_user_id', true) IS NOT NULL
  AND user_id = current_setting('app.current_user_id', true)::BIGINT
);
```

## Interfaces / Contracts

All request/response shapes match `@template-ai/contracts` Zod schemas exactly. Controllers validate incoming bodies using shared Zod schemas before passing to services:

```typescript
// Example: POST /api/templates validation in controller
import { TemplateSchema } from '@template-ai/contracts';

const CreateTemplateBody = TemplateSchema.omit({ id: true, createdAt: true });

@Post()
async create(@Body() body: unknown) {
  const parsed = CreateTemplateBody.parse(body);  // throws ZodError → 400
  return this.templatesService.create(parsed);
}
```

**Error response contract** (matches MSW handlers):

| Status | Trigger | Response Shape |
|--------|---------|----------------|
| 400 | Zod validation failure | `{ error: string }` |
| 404 | Entity/document not found | `{ error: "Entity not found" }` |
| 409 | Duplicate template name | `{ error: 'Ya existe una plantilla llamada "..." . Elegí otro nombre.' }` |
| 500 | Unhandled server error | `{ error: string }` |

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | Service logic: analysis progress calc, validation, entity mapping | Vitest + mock repositories (TDD: test first) |
| Unit | Controller: request parsing, response mapping, error handling | Vitest + NestJS `Test.createTestingModule` |
| Integration | Full HTTP cycle: upload → poll → review → save template | supertest + Docker Postgres + test DB |
| Regression | All 45 existing tests | Must remain green — no changes to `domain-schema-first` or `health` modules |

**TDD discipline**: every service and controller gets a `.spec.ts` written BEFORE the implementation. Strict TDD mode is enabled.

## Migration / Rollout

1. Run `0002_document_templates.sql` — purely additive, no existing data affected
2. Deploy API with new modules + global prefix + CORS
3. Set `NEXT_PUBLIC_MSW=false` in frontend `.env.local`
4. Add Next.js rewrites proxy in `next.config.ts`
5. No feature flags needed — the `NEXT_PUBLIC_MSW` toggle IS the switch

## Open Questions

- [ ] Dev user seeding: should the migration INSERT a sentinel user for POC testing, or should we create one via the existing `DomainSchemaFirstService.createUser()` before integration tests?
- [ ] File storage post-POC: S3-compatible (MinIO for local dev) vs local filesystem?
- [ ] Real AI analysis: OpenRouter integration + BullMQ job queue — separate change or part of this one?
- [ ] Should `GET /api/analysis/:id/status` be kept as a separate lightweight endpoint, or can the frontend just use `GET /api/analysis/:id` for all polling?
