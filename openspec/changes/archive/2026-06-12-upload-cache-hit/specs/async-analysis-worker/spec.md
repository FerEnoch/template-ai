# Delta for async-analysis-worker

## MODIFIED Requirements

### Requirement: Worker processes analysis jobs

An in-process worker MUST consume `analysis-queue` jobs. For each job, the worker MUST check the text extraction cache (`ai:text:{contentHash}`) and AI response cache (`ai:resp:{sha256(text)}`) before performing expensive work. On cache hit, the worker MUST use the cached result and skip the corresponding step. On cache miss, the worker MUST extract text, call the AI service, populate both caches, persist entities, and set the analysis status to `completed`.
(Previously: worker always extracted text and called AI for every job with no caching.)

#### Scenario: Cache-hit skips extraction and AI call

- GIVEN a document whose text and AI response are cached in Redis
- WHEN the worker processes it
- THEN text extraction and AI call are skipped
- AND cached entities are persisted and status becomes `completed`

#### Scenario: Cache-miss runs full pipeline

- GIVEN a job on the queue with no cached results
- WHEN the worker processes it
- THEN text is extracted, the AI service is called, entities are written to the database
- AND both caches are populated
- AND the analysis status becomes `completed`

#### Scenario: Worker does not block HTTP

- GIVEN the worker is processing a job
- WHEN a new analysis request arrives over HTTP
- THEN the new request is enqueued and the HTTP handler returns immediately

## ADDED Requirements

### Requirement: Redis-backed text extraction cache

`extractText()` MUST check Redis key `ai:text:{contentHash}` before running pdf-parse or mammoth. On MISS, it MUST run the extractor, serialize as JSON, and SET with TTL 7d. On HIT, it MUST deserialize and return. On Redis errors, the system MUST log a warning and fall through to the extractor — never throw.

#### Scenario: Cached text skips extractor

- GIVEN text was previously cached under `ai:text:{contentHash}`
- WHEN `extractText()` is called with the same hash
- THEN the cached text is returned with no pdf-parse/mammoth invocation

#### Scenario: Redis error falls through gracefully

- GIVEN Redis is unreachable
- WHEN `extractText()` is called
- THEN a warning is logged and the extractor runs normally

### Requirement: Redis-backed AI response cache

`extractEntities()` MUST check Redis key `ai:resp:{sha256(text)}` before calling OpenRouter. On MISS, it MUST call the model, serialize `ExtractEntitiesResult` as JSON, and SET with TTL 7d. On HIT, it MUST deserialize and return. The in-process `Map` (`responseCache`) MUST be removed. On Redis errors, the system MUST log a warning and fall through to the model call — never throw.

#### Scenario: AI result served from Redis

- GIVEN a prior AI response is cached under `ai:resp:{sha256(text)}`
- WHEN `extractEntities()` is called with the same text
- THEN the cached result is returned with no OpenRouter call

#### Scenario: Server restart preserves AI cache

- GIVEN the API process was restarted
- WHEN a document with cached AI results is re-analyzed
- THEN the cached result is still available in Redis

### Requirement: Cache TTL and entry size guard

Both `ai:text:*` and `ai:resp:*` keys MUST expire after 7 days (604800s). Entries larger than 1 MB MUST NOT be written; instead log a warning and skip the cache write — the operation must still succeed.

#### Scenario: Oversized payload skips cache write

- GIVEN extracted text whose JSON exceeds 1 MB
- WHEN the cache write is attempted
- THEN a warning is logged with key and size
- AND no Redis SET is performed

### Requirement: Feature flag disables all caching

When `AI_CACHE_ENABLED` is `false`, both `extractText()` and `extractEntities()` MUST skip all Redis cache checks and writes — behaving exactly as before this change. Jobs MUST still process normally.

#### Scenario: Flag disabled returns to current behavior

- GIVEN `AI_CACHE_ENABLED=false`
- WHEN the worker processes a job
- THEN no Redis GET/SET occurs for `ai:text:*` or `ai:resp:*`
- AND text extraction and AI calls execute on every job as today
