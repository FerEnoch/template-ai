# Proposal: Upload Cache Hit

## Intent

Re-uploading the same file today triggers the full pipeline (disk save, DB inserts, BullMQ, text extraction, OpenRouter, entity insert) every time. The cache "doesn't work" because `OpenRouterService.responseCache` is an in-process `Map` wiped on every server restart (NestJS hot-reload, redeploy), and even when warm it only short-circuits the LLM call.

Make cache hits observable and end-to-end: dedupe at upload by raw bytes, persist the AI response cache in Redis, cache extracted text by file hash, add TTL.

## Scope

### In Scope
- **File-level dedup at upload**: SHA-256 of raw bytes on `POST /api/documents/upload`. If a `documents` row with the same hash has a `completed` `analysis_results`, return it; skip disk write, inserts, BullMQ.
- **Redis-backed AI response cache**: replace the `Map` with Redis (`ai:resp:{sha256(text)}` → `ExtractEntitiesResult`, TTL 7d).
- **Redis-backed text extraction cache**: `extractText()` checks `ai:text:{contentHash}` before pdf-parse/mammoth (TTL 7d).
- **TTL + size guard**: 1MB max entry size.
- **Observability**: `X-Cache: HIT|MISS` header; structured logs (`cache_layer`, `key`, `hit`, `size`).

### Out of Scope
- Changing the AI cache key from extracted text to raw bytes. PDF formatting drift is separate.
- Semantic dedup, cache invalidation API, cache warming, in-memory state migration.

## Capabilities

### New Capabilities
- `upload-deduplication`: short-circuiting re-uploads of byte-identical files at the service boundary, returning prior results and skipping all downstream work.

### Modified Capabilities
- `async-analysis-worker`: AI cache backing store changes from `Map` to Redis. External contract (BullMQ job → entities) unchanged.
- `local-operational-infra`: Redis gains a second use (response + text cache) alongside BullMQ. Key namespaces and client wiring must accommodate multiple consumers without collision.

## Approach

**Layered cache, two keys, one store.** Keep the `extractEntities()` API; swap the cache implementation. Add an upload-boundary layer that checks `documents` for an existing `content_hash` with a `completed` analysis.

**Upload-time dedup:** Multer buffers file → `contentHash = SHA-256(raw bytes)` before disk write. `DocumentsService.upload()` queries `documents` by `content_hash` joining `analysis_results`. If `completed` row exists → return `{ documentId, analysisId, status: "completed", entities, X-Cache: HIT }`, skip disk write/inserts/BullMQ. Else → existing flow, stamp `content_hash` on insert.

**Worker-time cache (Redis):** `extractText()` checks `ai:text:{contentHash}` (miss → run extractors, `SET EX 604800`). `OpenRouterService.extractEntities()` checks `ai:resp:{sha256(text)}` (miss → call model, `SET EX 604800`). Remove the `Map`; constructor unchanged. Both serialize JSON; 1MB guard.

**Hexagonal fit:** wrap Redis in a `CachePort` interface with `RedisCacheAdapter` in `infrastructure/redis/`. Reuse the BullMQ Redis client; services stay unaware of ioredis.

**Observability:** set `X-Cache` in the controller. Replace single `logger.warn` with structured fields.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `apps/api/src/ai/open-router.service.ts` | Modified | Remove `responseCache` Map; inject `CachePort`; Redis GET/SET around `extractEntities`. |
| `apps/api/src/ai/document-analysis.service.ts` | Modified | Inject `CachePort`; check `ai:text:{contentHash}` before extractors. |
| `apps/api/src/documents/documents.controller.ts` | Modified | Set `X-Cache` header; pass file buffer for hashing. |
| `apps/api/src/documents/documents.service.ts` | Modified | Compute `contentHash`; short-circuit on completed match. |
| `apps/api/src/infrastructure/postgres/repositories/documents.repository.ts` | New column | `documents.content_hash TEXT` + index. |
| `apps/api/src/analysis/analysis.processor.ts` | Modified | Pass `contentHash` to `extractText`. |
| `apps/api/src/infrastructure/redis/` | New | `CachePort` + `RedisCacheAdapter`; reuse BullMQ client. |
| `apps/api/src/config/ai.ts` | Modified | Add `AI_CACHE_ENABLED`, `AI_RESPONSE_CACHE_TTL`, `AI_TEXT_CACHE_TTL`, `AI_CACHE_MAX_ENTRY_BYTES`. |
| `apps/api/src/main.ts` (DI) | Modified | Bind `CachePort` → `RedisCacheAdapter`. |
| `apps/api/src/migrations/` | New | `add_content_hash_to_documents`. |
| `packages/contracts` | Modified | `UploadResponse` gains optional `cachedFromDocumentId`. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Redis outage breaks upload | Med | `AI_CACHE_ENABLED=false` returns to current behavior. All cache calls try/catch → miss, never fail. |
| Large extracted text exceeds Redis value size | Low | 1MB guard; log + skip cache. |
| Stale cache on edited file | Very Low | Any byte change → new hash → new key. Byte-identical dedup is the intent. |
| Backfill: existing rows have no `content_hash` | Med | Migration sets NULL; dedup query only matches non-null hashes. No historical dedup. |
| Reviewer budget (>800 lines) | High | Force-chained. 3–4 PRs: (1) schema + cache port, (2) Redis adapter + AI swap, (3) upload dedup + header, (4) observability + cleanup. Confirm at `sdd-tasks`. |

## Rollback Plan

- **Feature flag**: `AI_CACHE_ENABLED=false` disables both Redis caches and the upload short-circuit. Zero code changes; restart picks it up.
- **Code rollback**: each layer is its own commit/PR. A bad PR reverts cleanly.
- **Schema rollback**: `content_hash` is additive and nullable. Downgrade migration drops the index and column. No data loss — hash is derived.
- **Redis cleanup**: keys are namespaced (`ai:resp:*`, `ai:text:*`). `redis-cli DEL` clears if needed.

## Dependencies

- Redis (already required by BullMQ via `compose.yaml`). No new infra.
- `ioredis` (already a dependency). Reuse the existing client.

## Success Criteria

- [ ] Re-uploading a byte-identical file within 7d returns same `analysisId` and `entities` in <500ms p95, `X-Cache: HIT`.
- [ ] Server restart does NOT invalidate cache: fresh API process still returns hits for prior uploads.
- [ ] Disk write, `documents` insert, `analysis_results` insert, and BullMQ enqueue all skipped on cache hit (verified via structured logs).
- [ ] `extractText()` runs at most once per unique file content within TTL.
- [ ] Zero OpenRouter calls on cache hit; exactly one per unique `extractEntities` input within TTL.
- [ ] `AI_CACHE_ENABLED=false` returns system to current behavior with no errors.
- [ ] Redis unavailability does not break uploads (graceful degrade to miss + warning log).
