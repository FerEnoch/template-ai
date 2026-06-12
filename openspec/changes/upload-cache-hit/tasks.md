# Tasks: Upload Cache Hit

## Review Workload Forecast

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: Low

| Field | Value |
|-------|-------|
| Estimated changed lines | ~600-800 (4 PRs) |
| Delivery strategy | force-chained |
| Review budget | 800 lines/PR |
| Split | PR1 → PR2 → PR3 → PR4 |

### Work Units

| Unit | Goal | PR |
|------|------|----|
| 1 | Schema + CachePort + adapter | PR1 ~250L |
| 2 | Worker caches (text + AI) | PR2 ~200L, dep PR1 |
| 3 | Upload dedup + multer | PR3 ~250L, dep PR1+2 |
| 4 | Contracts + env + logs | PR4 ~100L, dep PR3 |

## PR #1: Foundation

- [x] **1.1** Add `0008_content_hash.sql` — `ALTER TABLE documents ADD COLUMN content_hash TEXT` + partial index `WHERE content_hash IS NOT NULL`. Verify `migration:run`. ~10L.
- [x] **1.2** Add to `config/env.ts`+`config/ai.ts`: `AI_CACHE_ENABLED` (false), `AI_RESPONSE_CACHE_TTL` (604800), `AI_TEXT_CACHE_TTL` (604800), `AI_CACHE_MAX_ENTRY_BYTES` (1048576). Verify build. ~20L.
- [x] **1.3** Create `infrastructure/redis/cache.port.ts` — `CachePort { get<T>, set, getOrSet<T> }` + `CACHE_PORT` symbol. ~15L.
- [x] **1.4** Create `infrastructure/redis/redis-cache.adapter.ts` — ioredis impl, JSON, 1MB guard, try/catch→null. ~80L.
- [x] **1.5** Create `infrastructure/redis/redis-cache.module.ts` + `index.ts` — dedicated ioredis client, binds `CACHE_PORT`→adapter. ~60L.
- [x] **1.6** Import `CacheModule` in `app.module.ts`. Verify boot. ~5L.
- [x] **1.7** `redis-cache.adapter.spec.ts` — hit/miss, getOrSet, 1MB guard, JSON, error swallow. ~80L.

## PR #2: Worker Caches

- [x] **2.1** `ai/open-router.service.ts` — drop `responseCache` Map; inject `CACHE_PORT`; wrap `extractEntities` with `getOrSet("ai:resp:"+sha256(text), ttl, callOpenRouter)`. Update spec. ~50L.
- [x] **2.2** `ai/document-analysis.service.ts` — inject `CACHE_PORT`; accept optional `contentHash` in `analyze()`; wrap `extractText` with `getOrSet("ai:text:"+contentHash, ttl, runExtractor)`. Update spec. ~40L.
- [x] **2.3** `analysis/analysis.queue.ts`+`analysis.processor.ts` — add `contentHash?: string` to `AnalysisJobPayload`; processor passes to `analyze()`. Update spec. ~20L.
- [x] **2.4** Import `CacheModule` in `ai/ai.module.ts`. Verify boot. ~5L.
- [x] **2.5** `analysis.processor.integration.spec.ts` — same `contentHash` twice; second skips extractors+OpenAI. Asserts log `cache_layer:"text"`, `hit:true`. ~80L.

## PR #3: Upload Dedup

- [x] **3.1** `infrastructure/postgres/repositories/documents.repository.ts` — add `contentHash` to `DocumentRecord`+`CreateDocumentInput`; update `create()`; add `findByContentHashWithCompletedAnalysis(hash)` joining `analysis_results WHERE status='completed'`. Update spec. ~50L.
- [x] **3.2** `documents/documents.controller.ts` — switch multer to `memoryStorage`; compute `contentHash = SHA-256(file.buffer)`; pass buffer+hash to service. ~30L.
- [x] **3.3** `documents/documents.service.ts` — `UploadInput { fileBuffer, originalName, mimeType, contentHash }`; if `AI_CACHE_ENABLED` and dedup hit, return cached `{ documentId, analysisId, status, entities, cachedFromDocumentId }`; else write buffer to disk, create with `contentHash`, enqueue. Update spec. ~80L.
- [x] **3.4** Set `X-Cache` header in controller — `res.setHeader("X-Cache", hit?"HIT":"MISS")`; omit when flag disabled. Update spec. ~15L.
- [x] **3.5** Import `CacheModule` in `documents/documents.module.ts` if config needed. ~5L. (SKIPPED — `CACHE_CONFIG` accessed via static import, no DI needed)
- [x] **3.6** Extend `documents.controller.integration.spec.ts` — upload→complete→re-upload; assert same `analysisId`+entities, `X-Cache:HIT`, one `documents` row, no new BullMQ job. ~60L.

## PR #4: Contracts, Env, Logs

- [ ] **4.1** `packages/contracts/src/schemas.ts` — add optional `cachedFromDocumentId?: string` to `UploadResponse`; update `schemas.test.ts`. ~15L.
- [ ] **4.2** Add to `.env.dev.example` — `AI_CACHE_ENABLED=true`, TTLs (604800), `AI_CACHE_MAX_ENTRY_BYTES=1048576`. ~10L.
- [ ] **4.3** Standardize logs in `open-router.service.ts`, `document-analysis.service.ts`, `documents.service.ts` — `logger.warn({ cache_layer, key, hit, size_bytes }, "cache event")`. ~25L.
- [ ] **4.4** `apps/api/docs/caching.md` — three layers, flag, `X-Cache`. Links specs. ~30L.
- [ ] **4.5** Final regression — `pnpm --filter @template-ai/api test` green; smoke: upload→complete→restart API→re-upload → HIT from Redis. 0L.
