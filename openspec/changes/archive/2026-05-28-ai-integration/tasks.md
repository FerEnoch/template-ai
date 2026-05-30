# Tasks: AI-Powered Document Analysis Integration

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~550-600 |
| 400-line budget risk | Medium |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (Foundation) → PR 2 (AI Services) |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | File persistence + foundation | PR 1 | Schema, env config, migration, Multer storage, repos (base: main) |
| 2 | AI services + integration | PR 2 | AiModule, OpenRouterService, DocumentAnalysisService, wire into AnalysisService (base: main or PR 1 branch) |

## Phase 1: Foundation — Schema, Config, Dependencies

### T-001: Add `openai` dependency + `filePath` to Document schema
- **Files**: `packages/contracts/src/schemas.ts`, `apps/api/package.json`
- **Est. lines**: 5
- **Depends on**: none
- **Verification**: `pnpm install` succeeds; `DocumentSchema.parse({...existingFields})` still passes without `filePath`; `DocumentSchema.parse({...existingFields, filePath: "/tmp/test.pdf"})` succeeds with `filePath` present

### T-002: Create AI config module + env validation for `OPENROUTER_API_KEY`
- **Files**: `apps/api/src/config/ai.ts` (create), `apps/api/src/config/ai.spec.ts` (create), `apps/api/src/config/env.ts` (modify)
- **Est. lines**: 85
- **Depends on**: T-001
- **Verification**: `ai.spec.ts` passes — missing `OPENROUTER_API_KEY` throws; defaults resolve `AI_MODEL` to `google/gemini-2.5-flash:free` and `UPLOAD_DIR` to `./uploads`; API bootstrap exits non-zero when key is missing

### T-003: Create migration 0004 — `file_path`, `retry_count`, `error_message`
- **Files**: `apps/api/src/infrastructure/postgres/migrations/0004_ai_file_persistence.sql` (create)
- **Est. lines**: 15
- **Depends on**: none
- **Verification**: SQL runs clean against test DB; `documents` table has `file_path TEXT` (nullable); `analysis_results` has `retry_count INTEGER DEFAULT 0` and `error_message TEXT`; CHECK constraint enforces retry_count BETWEEN 0 AND 3; partial index on `file_path WHERE NOT NULL` is created

## Phase 2: Infrastructure — Repositories, File Storage

### T-004: Update Documents repository + controller + service (Multer diskStorage)
- **Files**: `apps/api/src/infrastructure/postgres/repositories/documents.repository.ts` (modify), `apps/api/src/documents/documents.controller.ts` (modify), `apps/api/src/documents/documents.service.ts` (modify)
- **Est. lines**: 85
- **Depends on**: T-001, T-003
- **Verification**: Upload PDF via `POST /api/documents/upload` → file written to `UPLOAD_DIR/{uuid}-{suffix}.pdf`; DB `documents.file_path` matches disk path; file > 25MB returns 413; invalid mime type rejected; non-existent upload dir auto-created; `filePath` returned in document response

### T-005: Update AnalysisResults repository — retry tracking
- **Files**: `apps/api/src/infrastructure/postgres/repositories/analysis-results.repository.ts` (modify)
- **Est. lines**: 25
- **Depends on**: T-003
- **Verification**: `analysisResultsRepo.incrementRetry(id, errorMsg)` updates `retry_count += 1` and sets `error_message`; unit test asserts retry_count increments from 0 to 1

## Phase 3: Core AI — Module, OpenRouter Service, Analysis Orchestration

### T-006: Create AiModule + OpenRouterService with Spanish prompt + Zod validation
- **Files**: `apps/api/src/modules/ai/ai.module.ts` (create), `apps/api/src/modules/ai/open-router.service.ts` (create), `apps/api/src/modules/ai/open-router.service.spec.ts` (create)
- **Est. lines**: 170
- **Depends on**: T-002
- **Verification**: Unit tests pass — `extractEntities()` builds prompt with Spanish system message + few-shot examples; mocked `openai` SDK returns structured JSON; Zod filters invalid entities (missing `group`, bad `confidence`); valid entities pass through unchanged; network errors throw `OpenRouterError`; 401 response skips retry

### T-007: Create DocumentAnalysisService — orchestrate file read → AI → save entities
- **Files**: `apps/api/src/modules/ai/document-analysis.service.ts` (create), `apps/api/src/modules/ai/document-analysis.service.spec.ts` (create)
- **Est. lines**: 120
- **Depends on**: T-006, T-004, T-005
- **Verification**: Unit tests pass — `analyze()` reads file from disk, calls `OpenRouterService.extractEntities()`, inserts validated entities via repo, updates analysis status to `completed`; file-not-found returns `success: false` with error; AI failure returns `success: false` without entity insert

## Phase 4: Integration — Wire into Existing Analysis Flow

### T-008: Update AnalysisService — replace SAMPLE_ENTITIES with real AI + retry logic
- **Files**: `apps/api/src/analysis/analysis.service.ts` (modify)
- **Est. lines**: 45
- **Depends on**: T-007
- **Verification**: At `progress >= 100`, `DocumentAnalysisService.analyze()` is called; on success status becomes `completed` with real entities; on failure `retry_count` increments and status becomes `failed`; re-poll with `failed` + `retry_count < 3` re-attempts AI call; re-poll with `retry_count >= 3` returns permanent failure without re-attempt

### T-009: Wire AiModule into AnalysisModule and AppModule
- **Files**: `apps/api/src/analysis/analysis.module.ts` (modify), `apps/api/src/app.module.ts` (modify)
- **Est. lines**: 10
- **Depends on**: T-008
- **Verification**: App bootstraps without errors; `AiModule` providers are injectable; `AnalysisService` receives `DocumentAnalysisService` via DI

## Phase 5: Testing & Verification

### T-010: Integration test — upload + poll + AI extraction end-to-end
- **Files**: `apps/api/test/` (new spec or extend existing)
- **Est. lines**: 70
- **Depends on**: T-009
- **Verification**: Supertest flow: upload PDF → 201 with document + filePath → poll analysis → after progress hits 100, entities returned (mocked OpenRouter); status transitions: `processing` → `completed` (success) or `failed` (error); retry re-attempts work up to 3 times

### T-011: Manual verification checklist
- **Files**: `openspec/changes/ai-integration/tasks.md` (appended as note)
- **Est. lines**: 0 (metadata only)
- **Depends on**: T-010
- **Verification**: Human tests — upload real PDF, verify entities match document content; verify error message display; verify retry behavior; verify 25MB limit
