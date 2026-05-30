# Design: AI-Powered Document Analysis Integration

## Technical Approach

Replace `SAMPLE_ENTITIES` in `AnalysisService` with real AI extraction via OpenRouter SDK. Add file persistence through Multer `diskStorage` so uploaded documents are stored on disk and their path recorded in the `documents` table. A new `AiModule` encapsulates all AI concerns (`OpenRouterService`, `DocumentAnalysisService`). `AnalysisService` delegates to `DocumentAnalysisService` when `progress === 100` instead of inserting hardcoded entities.

The codebase uses **raw `pg`** (not Prisma) with repositories instantiated per-transaction. This design follows that pattern exactly — no ORM, no repository DI.

## Architecture Decisions

| Decision | Options | Tradeoff | Choice |
|----------|---------|----------|--------|
| AI module structure | (A) Single `AiModule` with both services, (B) Split `OpenRouterModule` + `AnalysisAiModule` | A is simpler; B over-engineers for 2 providers | **A: Single `AiModule`** |
| Repository pattern | (A) DI-injected repos, (B) Instantiate per-transaction like existing code | B matches codebase; A breaks consistency | **B: Per-transaction instantiation** |
| OpenRouter SDK vs raw fetch | (A) `openai` SDK pointed at OpenRouter base URL, (B) Raw `fetch` to REST API | A gives typed responses + retry; B is lighter | **A: `openai` SDK** (OpenRouter is OpenAI-compatible) |
| File storage location | (A) `process.cwd()/uploads`, (B) Configurable `UPLOAD_DIR` env | B is flexible but spec says default `./uploads` | **B: `UPLOAD_DIR` env, default `./uploads`** |
| Retry tracking | (A) New `retry_count` column on `analysis_results`, (B) In-memory counter | A survives restarts; B is lost on crash | **A: `retry_count` column** |
| AI call timing | (A) Sync in polling cycle, (B) Background worker | A matches proposal; B is future scope | **A: Sync in polling** |

## Data Flow

```
1. Client POST /api/documents/upload (multipart PDF)
       │
2. Multer diskStorage → writes to UPLOAD_DIR/{timestamp}-{random}.pdf
       │
3. DocumentsService.upload({ filename, mimeType, sizeBytes, filePath })
       │
4. DocumentsRepository.create → INSERT documents (with file_path)
       │
5. AnalysisResultsRepository.create → INSERT analysis_results (status: processing)
       │
6. Client polls GET /api/analysis/:id (or /:id/status)
       │
7. AnalysisService.getFullResult → incrementProgress (+25 per poll)
       │
8. When progress >= 100 AND status != completed AND retry_count < 3:
       │
9.   DocumentAnalysisService.analyze(documentId, filePath, analysisResultId)
       │
10.    OpenRouterService.extractEntities(filePath)
       │       ├── Read file from disk (fs.readFile)
       │       ├── Build Spanish prompt + few-shot examples
       │       ├── Call OpenRouter API (openai SDK, structured JSON output)
       │       └── Validate response against EntitySchema[] (Zod)
       │
11.    EntitiesRepository.bulkInsert(validated entities)
       │
12.    AnalysisResultsRepository.updateStatus(id, "completed")
       │
13. On failure: updateStatus(id, "failed") + increment retry_count
       │       └── Next poll re-attempts if retry_count < 3
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `apps/api/src/config/ai.ts` | Create | AI config: `OPENROUTER_API_KEY`, `AI_MODEL`, `UPLOAD_DIR` validation |
| `apps/api/src/config/ai.spec.ts` | Create | Tests for AI config validation |
| `apps/api/src/modules/ai/ai.module.ts` | Create | NestJS module exporting `OpenRouterService`, `DocumentAnalysisService` |
| `apps/api/src/modules/ai/open-router.service.ts` | Create | Wraps OpenAI SDK → OpenRouter, Spanish prompt, Zod validation |
| `apps/api/src/modules/ai/document-analysis.service.ts` | Create | Orchestrates: read file → call AI → save entities → update status |
| `apps/api/src/modules/ai/open-router.service.spec.ts` | Create | Unit tests for OpenRouterService |
| `apps/api/src/modules/ai/document-analysis.service.spec.ts` | Create | Unit tests for DocumentAnalysisService |
| `apps/api/src/infrastructure/postgres/migrations/0004_ai_file_persistence.sql` | Create | Add `file_path`, `retry_count`, `error_message` columns |
| `apps/api/src/infrastructure/postgres/repositories/documents.repository.ts` | Modify | Add `filePath` to `DocumentRecord`, `CreateDocumentInput`, SQL queries |
| `apps/api/src/infrastructure/postgres/repositories/analysis-results.repository.ts` | Modify | Add `retryCount`, `errorMessage` to record; add `incrementRetry()` method |
| `apps/api/src/documents/documents.controller.ts` | Modify | Add Multer `diskStorage` config, file size limit (25MB), pass `filePath` to service |
| `apps/api/src/documents/documents.service.ts` | Modify | Accept `filePath` in `UploadInput`, pass to repository |
| `apps/api/src/analysis/analysis.service.ts` | Modify | Inject `DocumentAnalysisService`; replace `SAMPLE_ENTITIES` with real AI call at progress 100 |
| `apps/api/src/analysis/analysis.module.ts` | Modify | Import `AiModule` |
| `apps/api/src/app.module.ts` | Modify | Import `AiModule` (for global config validation at bootstrap) |
| `apps/api/src/config/env.ts` | Modify | Add `OPENROUTER_API_KEY` to `ApiEnv` type and validation |
| `apps/api/src/main.ts` | Modify | No changes needed (env validation already eager-loads) |
| `packages/contracts/src/schemas.ts` | Modify | Add `filePath` (optional string) to `DocumentSchema` |
| `apps/api/package.json` | Modify | Add `openai` dependency |

## Interfaces / Contracts

### AI Config (`apps/api/src/config/ai.ts`)

```typescript
export type AiConfig = {
  openRouterApiKey: string;
  aiModel: string;
  uploadDir: string;
};

export function getAiConfig(): AiConfig {
  // OPENROUTER_API_KEY: required, fail fast if missing
  // AI_MODEL: optional, default "google/gemini-2.5-flash:free"
  // UPLOAD_DIR: optional, default "./uploads"
  // Cached singleton like getApiEnv()
}
```

### OpenRouterService (`apps/api/src/modules/ai/open-router.service.ts`)

```typescript
import { Injectable } from "@nestjs/common";
import { z } from "zod";

// Subset of EntitySchema for AI response validation (no id, reviewed, excluded)
const AiEntitySchema = z.object({
  label: z.string(),
  value: z.string(),
  group: z.enum(["PARTES", "INMUEBLE", "FECHAS", "ANEXOS"]),
  confidence: z.enum(["ALTA", "MEDIA", "BAJA"]),
  sourceSpan: z.object({
    start: z.number(),
    end: z.number(),
  }).optional(),
});

export type AiEntity = z.infer<typeof AiEntitySchema>;

export interface ExtractEntitiesResult {
  entities: AiEntity[];
  rawResponse: string;
}

@Injectable()
export class OpenRouterService {
  async extractEntities(filePath: string): Promise<ExtractEntitiesResult>;
}
```

### DocumentAnalysisService (`apps/api/src/modules/ai/document-analysis.service.ts`)

```typescript
import { Injectable } from "@nestjs/common";
import { PoolClient } from "pg";

export interface AnalyzeResult {
  success: boolean;
  entityCount: number;
  error?: string;
}

@Injectable()
export class DocumentAnalysisService {
  async analyze(
    client: PoolClient,
    documentId: string,
    filePath: string,
    analysisResultId: string,
  ): Promise<AnalyzeResult>;
}
```

### Updated UploadInput (`documents.service.ts`)

```typescript
export interface UploadInput {
  filename: string;
  mimeType: string;
  sizeBytes: number;
  filePath: string; // NEW: path to persisted file on disk
}
```

### Updated DocumentRecord

```typescript
export interface DocumentRecord {
  id: string;
  userId: number;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  status: string;
  uploadedAt: Date;
  filePath: string | null; // NEW
}
```

### Updated AnalysisResultRecord

```typescript
export interface AnalysisResultRecord {
  id: string;
  documentId: string;
  status: string;
  progress: number;
  startedAt: Date;
  completedAt: Date | null;
  retryCount: number;      // NEW
  errorMessage: string | null; // NEW
}
```

## Database Changes

### Migration 0004: `0004_ai_file_persistence.sql`

```sql
-- Add file_path to documents for disk persistence
ALTER TABLE documents
  ADD COLUMN file_path TEXT;

CREATE INDEX documents_file_path_idx ON documents (file_path)
  WHERE file_path IS NOT NULL;

-- Add retry tracking and error info to analysis_results
ALTER TABLE analysis_results
  ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN error_message TEXT;

-- Update analysis_results constraint to allow retry_count range
ALTER TABLE analysis_results
  ADD CONSTRAINT analysis_results_retry_count_max CHECK (retry_count BETWEEN 0 AND 3);
```

## AI Configuration Details

### Spanish System Prompt

```
Eres un asistente especializado en análisis de documentos legales mexicanos.
Extrae las entidades clave del documento proporcionado.

Para cada entidad, identifica:
- label: nombre del campo (ej: COMPRADOR, VENDEDOR, PRECIO_TOTAL)
- value: valor exacto encontrado en el documento
- group: categoría (PARTES, INMUEBLE, FECHAS, ANEXOS)
- confidence: nivel de confianza (ALTA, MEDIA, BAJA)
- sourceSpan: posición aproximada en el texto (start, end) si es posible

Responde EXCLUSIVAMENTE con un JSON array de entidades.
```

### Few-shot Example (embedded in prompt)

```json
[
  {"label": "COMPRADOR", "value": "Juan Pérez", "group": "PARTES", "confidence": "ALTA"},
  {"label": "PRECIO_TOTAL", "value": "$1,500,000.00 MXN", "group": "INMUEBLE", "confidence": "ALTA"}
]
```

### Model Resolution

| Environment | `AI_MODEL` set? | Resolved Model |
|-------------|-----------------|----------------|
| development | No | `google/gemini-2.5-flash:free` |
| development | Yes | Value of `AI_MODEL` |
| production | No | `google/gemini-2.5-flash:free` (still free tier) |
| production | Yes | Value of `AI_MODEL` (e.g., `google/gemini-2.5-pro`) |

### OpenAI SDK Configuration

```typescript
import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: getAiConfig().openRouterApiKey,
  defaultHeaders: {
    "X-Title": "Template AI",
    "HTTP-Referer": "https://template-ai.local",
  },
});
```

## Error Handling

| OpenRouter Error | HTTP Code | Action | Analysis Status |
|----------------|-----------|--------|-----------------|
| Network timeout / unreachable | — | Retry (up to 3) | `failed` (transient) |
| Rate limit (429) | 429 | Retry with exponential backoff (1s, 2s, 4s) | `failed` (transient) |
| Invalid API key (401) | 401 | No retry — config error | `failed` (permanent) |
| Model not found (404) | 404 | No retry — config error | `failed` (permanent) |
| Invalid JSON response | 200 | Retry (up to 3) | `failed` (transient) |
| Zod validation failure | 200 | Filter invalid entities, keep valid ones | `completed` (partial) |
| Max retries exceeded | — | No retry | `failed` (permanent) |

### Retry Logic in AnalysisService

```typescript
// In getFullResult, when progress >= 100:
if (result.status === "failed" && result.retryCount >= 3) {
  return this.mapToAnalysisResult(result, []); // permanent failure
}

if (result.status === "failed" && result.retryCount < 3 && result.progress >= 100) {
  // Re-attempt: reset status to processing, call AI again
  await analysisRepo.updateStatus(result.id, "processing");
  // Fall through to AI call below
}

if (incremented.progress >= 100) {
  const analysisResult = await this.documentAnalysisService.analyze(
    client, documentId, document.filePath, result.id
  );

  if (!analysisResult.success) {
    await analysisRepo.incrementRetry(result.id, analysisResult.error);
    await analysisRepo.updateStatus(result.id, "failed");
    return this.mapToAnalysisResult(result, []);
  }

  await analysisRepo.updateStatus(result.id, "completed");
  // ... fetch and return entities
}
```

### User-Visible Error Messages

| Scenario | `error_message` stored | User sees |
|----------|----------------------|-----------|
| Network error | `"OpenRouter API unreachable: <detail>"` | `"Analysis failed — please retry"` |
| Rate limit | `"Rate limit exceeded (attempt N/3)"` | `"Analysis failed — please retry"` |
| Invalid API key | `"Invalid OPENROUTER_API_KEY"` | `"Analysis configuration error"` |
| Max retries | `"Max retries (3) exceeded"` | `"Analysis permanently failed"` |

## File Storage

### Multer diskStorage Configuration

```typescript
import { diskStorage } from "multer";
import { extname, join } from "node:path";
import { randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";

const uploadDir = getAiConfig().uploadDir;
mkdirSync(uploadDir, { recursive: true });

export const multerStorage = diskStorage({
  destination: uploadDir,
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${randomBytes(8).toString("hex")}`;
    const ext = extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

export const multerFileFilter = (
  _req: unknown,
  file: Express.Multer.File,
  cb: (error: Error | null, accept: boolean) => void,
) => {
  const allowed = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "image/jpeg",
  ];
  cb(null, allowed.includes(file.mimetype));
};
```

### Cleanup Strategy (Future — not in this change)

- Orphaned files (document deleted but file remains) → cron job
- Failed uploads (file written but DB insert failed) → immediate `unlink` in catch block

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `getAiConfig()` validation (missing key, defaults, caching) | Vitest, env manipulation like `env.spec.ts` |
| Unit | `OpenRouterService.extractEntities` — prompt building, Zod filtering | Vitest, mock `openai` SDK |
| Unit | `DocumentAnalysisService.analyze` — orchestration, error paths | Vitest, mock `OpenRouterService` + repos |
| Unit | `AnalysisService.getFullResult` — retry logic, AI delegation | Vitest, mock `DocumentAnalysisService` |
| Unit | Multer config — filename generation, file filter | Vitest, direct function calls |
| Integration | Upload → DB record with `file_path` | Supertest + test DB (existing pattern) |
| Integration | Migration 0004 applies cleanly | `db:migrate:validate` script |
| E2E | Upload PDF → poll → real entities returned | Manual verification with test PDF |

## Migration / Rollout

1. **Migration 0004** is additive only — `file_path TEXT` (nullable), `retry_count INTEGER DEFAULT 0`, `error_message TEXT` (nullable). No data loss risk.
2. **Env var**: `OPENROUTER_API_KEY` must be added to `.env.dev` and CI before deploying. Startup fails fast without it.
3. **Dependency**: `openai` npm package added to `apps/api/package.json`.
4. **Rollback**: Revert `AnalysisService` to `SAMPLE_ENTITIES`. Remove `OPENROUTER_API_KEY` from env. `file_path` column is additive — no rollback migration needed.

## Open Questions

- [ ] Should `analysis_results.error_message` be exposed in the API response (`AnalysisResult` interface)? Currently the spec says status `failed` with error message stored, but the existing `AnalysisResult` type has no `errorMessage` field.
- [ ] The `openai` SDK adds ~2MB to the bundle. Acceptable for API-only usage, or should we use raw `fetch` to OpenRouter's REST API instead?
