# Caching Architecture

This document describes the three-layer caching system implemented for the upload and analysis pipeline.

## Overview

The caching system reduces redundant work across three layers:

1. **Upload deduplication** — short-circuits re-uploads of byte-identical files
2. **Text extraction cache** — avoids re-running PDF/DOCX extractors
3. **AI response cache** — avoids redundant OpenRouter API calls

All layers are backed by Redis and controlled by a single feature flag.

## Feature Flag

Set `AI_CACHE_ENABLED=true` to enable all cache layers. When disabled (`false`), the system behaves as if no cache exists — every upload triggers the full pipeline.

```bash
# .env or .env.dev
AI_CACHE_ENABLED=true
```

## Layer 1: Upload Deduplication

**Key**: `documents.content_hash` (SHA-256 of raw file bytes)

When a file is uploaded via `POST /api/documents/upload`:

1. Compute `SHA-256(file.buffer)` before any disk I/O
2. Query `documents` table for a row with matching `content_hash` AND a `completed` `analysis_results`
3. If found → return the cached document + entities, set `X-Cache: HIT` header
4. If not found → proceed with normal flow (disk write, DB insert, BullMQ enqueue), set `X-Cache: MISS`

**Behavior**: Skips disk write, `documents` insert, `analysis_results` insert, and BullMQ job on cache hit.

**Response shape**:

```json
{
  "id": "...",
  "filename": "contract.pdf",
  "status": "completed",
  "cachedFromDocumentId": "uuid-of-original-document"
}
```

The `cachedFromDocumentId` field is present only on cache hits and points to the original document that was analyzed.

## Layer 2: Text Extraction Cache

**Redis key**: `ai:text:{contentHash}`  
**TTL**: `AI_TEXT_CACHE_TTL` (default: 604800s = 7 days)

When `DocumentAnalysisService.analyze()` is called with a `contentHash`:

1. Check Redis for `ai:text:{contentHash}`
2. If found → return cached extracted text
3. If not found → run `pdf-parse` or `mammoth`, store result in Redis

**Behavior**: `extractText()` runs at most once per unique file content within TTL.

## Layer 3: AI Response Cache

**Redis key**: `ai:resp:{sha256(extractedText)}`  
**TTL**: `AI_RESPONSE_CACHE_TTL` (default: 604800s = 7 days)

When `OpenRouterService.extractEntities()` is called:

1. Compute `SHA-256(documentText)`
2. Check Redis for `ai:resp:{hash}`
3. If found → return cached `ExtractEntitiesResult`
4. If not found → call OpenRouter API, store result in Redis

**Behavior**: Zero OpenRouter calls on cache hit; exactly one per unique input within TTL.

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `AI_CACHE_ENABLED` | `false` | Master switch for all cache layers |
| `AI_RESPONSE_CACHE_TTL` | `604800` | AI response cache TTL in seconds (7 days) |
| `AI_TEXT_CACHE_TTL` | `604800` | Text extraction cache TTL in seconds (7 days) |
| `AI_CACHE_MAX_ENTRY_BYTES` | `1048576` | Max size per cache entry (1MB) |

Entries exceeding `AI_CACHE_MAX_ENTRY_BYTES` are silently skipped (logged as warning).

## Observability

### X-Cache Header

The `POST /api/documents/upload` endpoint returns an `X-Cache` header when caching is enabled:

- `X-Cache: HIT` — upload was served from cache (no disk write, no DB inserts, no BullMQ job)
- `X-Cache: MISS` — upload triggered the full pipeline

The header is omitted when `AI_CACHE_ENABLED=false`.

### Structured Logs

All cache operations emit structured logs with consistent fields:

```json
{
  "cache_layer": "ai_response | text_extraction | upload_dedup",
  "key": "truncated-hash-prefix",
  "hit": true,
  "size_bytes": 12345,
  "ttl": 604800
}
```

**Field definitions**:

- `cache_layer`: Identifies which cache layer emitted the log
  - `ai_response` — OpenRouter response cache
  - `text_extraction` — PDF/DOCX text extraction cache
  - `upload_dedup` — Upload deduplication check
- `key`: First 16 characters of the cache key (truncated to avoid leaking full hashes)
- `hit`: `true` if the operation was a cache hit, `false` for miss
- `size_bytes`: Size of the cached value in bytes (only on cache write)
- `ttl`: TTL in seconds (only on cache write)

## Fault Tolerance

All cache operations are wrapped in try/catch blocks. Cache failures degrade gracefully to misses — they never break the upload or analysis flow.

**Redis outage behavior**:

- Upload dedup: Falls through to normal flow (disk write + DB insert + BullMQ)
- Text extraction: Runs extractors directly
- AI response: Calls OpenRouter directly

Logs emit warnings on cache errors for monitoring.

## Rollback

Set `AI_CACHE_ENABLED=false` and restart the API. No code changes required.

To clear cached data:

```bash
# Clear all cache keys
redis-cli DEL $(redis-cli KEYS "ai:*")

# Or clear specific layers
redis-cli DEL $(redis-cli KEYS "ai:resp:*")
redis-cli DEL $(redis-cli KEYS "ai:text:*")
```

The `documents.content_hash` column is nullable and additive — dropping it does not affect existing data.

## Architecture Decisions

- **Single feature flag**: All three layers share `AI_CACHE_ENABLED` for simplicity. Granular per-layer flags were considered but rejected as premature complexity.
- **Redis over in-process Map**: The previous `Map`-based cache was wiped on every server restart (NestJS hot-reload, redeploy). Redis persists across restarts and scales horizontally.
- **SHA-256 keys**: Byte-identical files produce the same hash. Any edit → new hash → new cache entry. No semantic dedup (intentional scope limitation).
- **1MB size guard**: Prevents Redis memory exhaustion from unusually large extracted texts or AI responses.

## Related Specs

- Proposal: `openspec/changes/upload-cache-hit/proposal.md`
- Tasks: `openspec/changes/upload-cache-hit/tasks.md`
- Migration: `apps/api/src/migrations/0008_content_hash.sql`
