# Proposal: AI-Powered Document Analysis Integration

## Intent

Replace hardcoded `SAMPLE_ENTITIES` in the analysis service with real AI-powered entity extraction via OpenRouter. Enable file persistence (local disk via Multer) so uploaded documents are stored and analyzed instead of discarded. This delivers the core AI value proposition: users upload PDFs and receive actual extracted entities, not mock data.

## Scope

### In Scope
- OpenRouter SDK integration with structured JSON output
- File persistence using Multer diskStorage (path stored in DB)
- Real AI analysis replacing hardcoded sample entities
- Environment-driven AI config module (`apps/api/src/config/ai.ts`)
- Sync-in-polling within existing `AnalysisService` transaction
- Spanish system prompt with few-shot examples for entity extraction

### Out of Scope
- Auth integration (no changes to auth/ownership)
- Async worker/queue (analysis runs synchronously within polling cycle)
- Document viewer or text extraction from PDF (backend receives file path only)
- Cost tracking dashboard or usage metering

## Capabilities

### New Capabilities
- `ai-analysis`: Real AI entity extraction via OpenRouter SDK using `google/gemini-2.5-flash:free` with JSON schema structured output.

### Modified Capabilities
- `shared-contracts`: Add `filePath` field to `Document` schema to support persisted file storage.
- `app-bootstrap-runtime`: Extend API bootstrap contract to validate `OPENROUTER_API_KEY` and `AI_MODEL` environment variables.

## Approach

Reuse the existing polling cycle in `AnalysisService`. When the first poll hits `progress === 100%`, trigger the real AI call instead of returning `SAMPLE_ENTITIES`.

1. **Config**: `apps/api/src/config/ai.ts` reads `AI_MODEL` (default: `google/gemini-2.5-flash:free` for dev, overridable for prod).
2. **Module**: `AiModule` encapsulates all AI-related providers.
3. **Service**: `OpenRouterService` wraps the SDK, handles Spanish system prompt + few-shot examples, and validates JSON schema output against the `Entity` contract.
4. **Persistence**: `DocumentRepository` updated to store `file_path` (new column via migration `0004`). Multer `diskStorage` configured in the documents controller.
5. **Analysis**: `DocumentAnalysisService` orchestrates the flow: read file → build prompt → call OpenRouter → parse entities → save to DB.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `apps/api/src/config/ai.ts` | New | AI configuration module with env-driven model selection |
| `apps/api/src/modules/ai/` | New | `AiModule`, `OpenRouterService`, `DocumentAnalysisService` |
| `apps/api/src/modules/documents/` | Modified | Controller (Multer), service, repository — add file persistence |
| `apps/api/src/modules/analysis/` | Modified | Service replaces `SAMPLE_ENTITIES` with real AI call |
| `packages/contracts` | Modified | `Document` schema gains `filePath` field |
| `apps/api/prisma/migrations/` | New | Migration `0004` adds `file_path` column to `documents` table |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Spanish prompt yields inaccurate entity labels | Medium | Few-shot examples in prompt; validate output against Zod schema |
| Large PDFs exceed token limits / incur cost | Low | Use free-tier model in dev; enforce 25 MB upload limit; monitor response size |
| JSON parsing failures from model | Low | SDK uses `responseFormat: json_schema`; fallback to `failed` status with retry |
| OpenRouter latency degrades polling UX | Medium | Keep sync-in-polling; if latency > 10s, consider async worker in future change |

## Rollback Plan

1. Revert `AnalysisService` to return `SAMPLE_ENTITIES` on `progress === 100%`.
2. Remove `OPENROUTER_API_KEY` from env (API fails fast if missing, but mock fallback can be restored).
3. The `file_path` column is additive — no data loss on rollback.

## Dependencies

- `@openrouter/sdk` npm package (install in `apps/api`)
- `OPENROUTER_API_KEY` environment variable
- New Prisma migration `0004` adding `file_path` to `documents`

## Success Criteria

- [ ] Upload a PDF → poll analysis → receive real entities extracted by AI (not hardcoded `SAMPLE_ENTITIES`)
- [ ] Entity count and labels match actual document content (verified manually on test PDFs)
- [ ] Failed analysis sets status to `failed` and allows retry via re-poll
- [ ] File is persisted to local disk and `filePath` is returned in document response
- [ ] Dev environment uses free-tier model without API key cost

## Non-Goals

- Real-time streaming analysis (current polling is sufficient for MVP)
- Multi-document batch analysis
- Template auto-generation from extracted entities
