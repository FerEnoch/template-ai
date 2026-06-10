# Design: Upload Cache Hit

## Technical Approach

Three-layer caching to eliminate redundant work on re-uploads:

1. **Upload boundary** — SHA-256 of raw bytes before disk write. Query `documents` by `content_hash` JOIN `analysis_results` WHERE `status = 'completed'`. Hit → return cached entities, skip everything downstream.
2. **Text extraction cache** — Redis `ai:text:{contentHash}` → extracted text (7d TTL). Avoids re-running pdf-parse/mammoth.
3. **AI response cache** — Redis `ai:resp:{sha256(text)}` → `ExtractEntitiesResult` (7d TTL). Replaces the in-memory `Map` that dies on restart.

All cache layers are optional enhancements gated by `AI_CACHE_ENABLED`. Failure = miss, never error.

## Architecture Decisions

| Decision | Options | Tradeoff | Choice |
|----------|---------|----------|--------|
| Multer storage strategy | (A) `memoryStorage` → hash buffer → conditional disk write. (B) Keep `diskStorage` → read back → hash → delete on hit. | (A) cleaner I/O, no wasted writes on hits. (B) no multer change but double I/O on hits. | **A — `memoryStorage`** |
| Redis client | (A) New dedicated `ioredis` client, same host/port. (B) Extract BullMQ's internal client. | (A) simple, isolated failure domains. (B) fragile — BullMQ doesn't expose its client cleanly. | **A — dedicated client** |
| CachePort DI pattern | (A) NestJS injection token `CACHE_PORT` + `CacheModule`. (B) Constructor param with manual wiring. | (A) follows NestJS conventions used everywhere in the project. (B) inconsistent with module-based DI. | **A — NestJS module + token** |
| CachePort API surface | (A) `get/set/delete`. (B) `get/set/getOrSet`. | (A) minimal. (B) `getOrSet` encapsulates the common check-then-populate pattern, reduces duplication. | **B — get, set, getOrSet** |
| Upload dedup query scope | (A) Match `content_hash` across all users. (B) Match per-user only. | (A) maximizes cache hits — identical content is identical regardless of uploader. (B) safer but misses cross-user dedup. | **A — cross-user** (content is content) |
| Text cache key | (A) `contentHash` (file bytes hash). (B) `filePath`. | (A) stable, survives file moves. (B) coupled to filesystem. | **A — contentHash** |

## Data Flow

### Upload — Cache Hit Path

```
Client ──POST /upload──→ DocumentsController
                              │
                     memoryStorage (buffer in RAM)
                              │
                     SHA-256(buffer) → contentHash
                              │
                     DocumentsRepository.findByContentHash(contentHash)
                              │
                     ┌─── JOIN analysis_results WHERE status='completed' ───┐
                     │ HIT                                                   │ MISS
                     ▼                                                       ▼
              Return cached entities                                  Write to disk
              X-Cache: HIT                                            INSERT document (with content_hash)
              Skip: disk write, DB inserts,                           INSERT analysis_results
                    BullMQ enqueue                                    Enqueue BullMQ job
                                                                      X-Cache: MISS
```

### Worker — Cache Layers

```
AnalysisProcessor.process(job)
    │
    ├─ extractText(filePath, contentHash)
    │     │
    │     ├─ CachePort.get("ai:text:{contentHash}")
    │     │     HIT → return cached text
    │     │     MISS → pdf-parse/mammoth → CachePort.set("ai:text:{contentHash}", text, 7d)
    │     │
    │     └─ return extractedText
    │
    └─ OpenRouterService.extractEntities(text)
          │
          ├─ CachePort.get("ai:resp:{sha256(text)}")
          │     HIT → return cached result
          │     MISS → call OpenRouter → CachePort.set(key, result, 7d)
          │
          └─ return ExtractEntitiesResult
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `apps/api/src/infrastructure/redis/cache.port.ts` | Create | `CachePort` interface — `get<T>(key)`, `set(key, value, ttlSec)`, `getOrSet<T>(key, ttlSec, factory)` |
| `apps/api/src/infrastructure/redis/redis-cache.adapter.ts` | Create | `RedisCacheAdapter implements CachePort` — ioredis client, JSON serialize, 1MB guard, try/catch on every op |
| `apps/api/src/infrastructure/redis/redis.module.ts` | Create | `CacheModule` — creates ioredis client, provides `CACHE_PORT` token, reads config |
| `apps/api/src/infrastructure/redis/index.ts` | Create | Barrel export |
| `apps/api/src/config/ai.ts` | Modify | Add `AI_CACHE_ENABLED` (bool, default `false`), `AI_RESPONSE_CACHE_TTL` (default 604800), `AI_TEXT_CACHE_TTL` (default 604800), `AI_CACHE_MAX_ENTRY_BYTES` (default 1048576) |
| `apps/api/src/config/env.ts` | Modify | Add optional `AI_CACHE_ENABLED` to `ApiEnv` type (parsed, default false) |
| `apps/api/src/infrastructure/postgres/migrations/0008_content_hash.sql` | Create | `ALTER TABLE documents ADD COLUMN content_hash TEXT; CREATE INDEX documents_content_hash_idx ON documents(content_hash) WHERE content_hash IS NOT NULL;` |
| `apps/api/src/infrastructure/postgres/repositories/documents.repository.ts` | Modify | Add `contentHash` to `DocumentRecord`, `CreateDocumentInput`. Add `findByContentHash(hash)` method joining `analysis_results`. Update `create()` to include `content_hash`. |
| `apps/api/src/documents/documents.controller.ts` | Modify | Switch multer to `memoryStorage`. Compute SHA-256 from `file.buffer`. Set `X-Cache` header via `@Res()` or `@Header()` decorator. Write to disk only on cache miss. |
| `apps/api/src/documents/documents.service.ts` | Modify | Accept `fileBuffer: Buffer` in `UploadInput`. Compute `contentHash`. Call `findByContentHash` for dedup check. On miss: write file to disk, proceed with existing flow. |
| `apps/api/src/documents/documents.module.ts` | Modify | Import `CacheModule` |
| `apps/api/src/ai/open-router.service.ts` | Modify | Remove `responseCache` Map. Inject `CACHE_PORT`. Redis get/set around `extractEntities`. Structured log with `cache_layer` field. |
| `apps/api/src/ai/document-analysis.service.ts` | Modify | Inject `CACHE_PORT`. Accept optional `contentHash` param in `analyze()`. Check `ai:text:{contentHash}` before extractors. |
| `apps/api/src/ai/ai.module.ts` | Modify | Import `CacheModule` |
| `apps/api/src/analysis/analysis.processor.ts` | Modify | Pass `contentHash` from job data to `documentAnalysisService.analyze()`. |
| `apps/api/src/analysis/analysis.queue.ts` | Modify | Add `contentHash?: string` to `AnalysisJobPayload` |
| `apps/api/src/app.module.ts` | Modify | Import `CacheModule` (or let feature modules import it) |

## Interfaces / Contracts

```typescript
// cache.port.ts
export interface CachePort {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttlSeconds: number): Promise<void>;
  getOrSet<T>(key: string, ttlSeconds: number, factory: () => Promise<T>): Promise<T>;
}

// Injection token
export const CACHE_PORT = Symbol("CACHE_PORT");
```

```typescript
// redis-cache.adapter.ts — key patterns
const AI_RESPONSE_PREFIX = "ai:resp:";
const AI_TEXT_PREFIX = "ai:text:";
// Keys: ai:resp:{sha256(text)}, ai:text:{contentHash}
```

```sql
-- 0008_content_hash.sql
ALTER TABLE documents ADD COLUMN IF NOT EXISTS content_hash TEXT;
CREATE INDEX IF NOT EXISTS documents_content_hash_idx
  ON documents(content_hash)
  WHERE content_hash IS NOT NULL;
```

```typescript
// DocumentsRepository — new method
async findByContentHashWithCompletedAnalysis(contentHash: string): Promise<{
  document: DocumentRecord;
  analysisResultId: string;
  entities: EntityRecord[];
} | null>
// Query: SELECT d.*, ar.id AS analysis_result_id
//        FROM documents d
//        JOIN analysis_results ar ON ar.document_id = d.id
//        WHERE d.content_hash = $1 AND ar.status = 'completed'
//        ORDER BY ar.completed_at DESC LIMIT 1
//        Then: SELECT * FROM entities WHERE analysis_result_id = $1
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `RedisCacheAdapter` — get/set/getOrSet, 1MB guard, JSON serialize, try/catch graceful degrade | Mock ioredis client. Verify key patterns, TTL, size guard. |
| Unit | `DocumentsService.upload()` — cache hit returns early, cache miss proceeds with full flow | Mock `DocumentsRepository`, `CachePort`. Assert `findByContentHash` called, disk write skipped on hit. |
| Unit | `OpenRouterService.extractEntities()` — Redis cache hit skips API call, miss calls API and caches | Mock `CachePort` + OpenAI client. |
| Unit | `DocumentAnalysisService.analyze()` — text cache hit skips pdf-parse, miss extracts and caches | Mock `CachePort` + filesystem + OpenRouterService. |
| Integration | Upload dedup end-to-end: upload file → complete analysis → re-upload same file → verify HIT | Real Postgres + Redis (test containers or local). Verify `X-Cache: HIT`, no duplicate DB rows. |
| Integration | `AI_CACHE_ENABLED=false` — all cache operations skipped, system behaves as before | Env override in test setup. |
| E2E | Upload → poll → re-upload → verify same entities returned | Existing Playwright infra, if applicable. |

## Migration / Rollout

1. **Migration `0008_content_hash.sql`**: Add nullable `content_hash TEXT` column + partial index. No backfill — existing rows stay NULL, dedup query only matches non-null.
2. **Feature flag**: `AI_CACHE_ENABLED=false` (default). Deploy code first, enable per-environment.
3. **Rollout order**: (1) migration, (2) CachePort + RedisCacheAdapter, (3) AI response cache swap, (4) text cache, (5) upload dedup. Each layer independently deployable.
4. **Rollback**: `AI_CACHE_ENABLED=false` disables all caching instantly. Schema rollback: drop index + column (no data loss, hash is derived).

## Open Questions

- [ ] Should the upload dedup return the *original* document ID or create a new document row pointing to the same analysis? Current design returns the original document's data — verify this matches frontend expectations.
- [ ] Multer `memoryStorage` holds the entire file in RAM. For 25MB uploads this is fine, but should we add a `memoryStorage` size limit separate from the file size validator?
