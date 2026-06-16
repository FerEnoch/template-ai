# async-analysis-worker Specification

## Purpose

Decouple AI analysis from the HTTP request lifecycle so document analysis runs asynchronously through a job queue, removing the 20–30s HTTP block and the 10-minute `requestTimeout` band-aid. This spec defines the externally observable contract for the `analysis-queue`, its processor, and its failure paths.

## Requirements

### Requirement: Analysis queue registration

The system MUST register an `analysis-queue` job queue backed by Redis in the NestJS application. The Redis connection MUST be configured from `REDIS_HOST` and `REDIS_PORT` environment variables. Startup MUST fail fast if the required Redis variables are missing.

#### Scenario: Queue connects to Redis from env

- GIVEN `REDIS_HOST=localhost` and `REDIS_PORT=6379`
- WHEN the application boots
- THEN the `analysis-queue` is registered and ready to accept jobs
- AND the Redis connection uses the configured host and port

#### Scenario: Startup fails when Redis config is missing

- GIVEN `REDIS_HOST` is absent
- WHEN the application boots
- THEN startup fails with an error naming the missing variable

### Requirement: Asynchronous phase-2 enqueue

After the atomic `processing → analyzing` transition, the analysis service MUST enqueue a job onto `analysis-queue` and MUST return from the HTTP handler without waiting for AI inference. The payload MUST carry the analysis id and document source so the worker can run without further HTTP calls.

#### Scenario: Enqueue returns immediately

- GIVEN an analysis has just transitioned to `analyzing`
- WHEN the analysis service completes phase 2
- THEN a job is added to `analysis-queue` and the HTTP call returns
- AND no OpenRouter call is made inside the HTTP request

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

### Requirement: Retry policy for transient failures

The `analysis-queue` MUST retry failed jobs up to 3 attempts with exponential backoff starting at 5 seconds. Retries MUST apply to transient errors (AI service errors, network timeouts). After the final attempt, the job MUST be treated as terminally failed.

#### Scenario: Transient error triggers retry

- GIVEN a job is being processed and the AI call fails with a transient error
- WHEN the first attempt fails
- THEN the job is re-queued with backoff
- AND a second attempt runs after the backoff window

#### Scenario: Exhausted retries mark failure

- GIVEN a job has already failed twice
- WHEN the third attempt also fails
- THEN the system treats the job as terminally failed
- AND no further retry is scheduled

### Requirement: Concurrency limit

The worker MUST process at most 2 jobs concurrently. Additional jobs MUST wait in the queue and be processed as in-flight slots free.

#### Scenario: Queue caps in-flight jobs

- GIVEN 5 jobs are added to an empty queue
- WHEN the worker boots
- THEN at most 2 jobs run in parallel
- AND the remaining 3 are processed sequentially as slots free

### Requirement: Failure status and error preservation

When a job is terminally failed, the system MUST set the analysis status to `failed` and MUST preserve the error message. The system MUST NOT leave the analysis in `analyzing` after a terminal failure.

#### Scenario: Status transitions to failed

- GIVEN a job has exhausted all retries
- WHEN the final attempt fails
- THEN the analysis status becomes `failed`
- AND an error message describing the failure is stored with the analysis

### Requirement: Status flow is unchanged

The system MUST NOT introduce new status values. The existing flow `processing → analyzing → completed|failed` MUST cover the queued and in-flight states; the `analyzing` status represents both "queued for AI" and "AI in progress".

#### Scenario: No new contract statuses

- GIVEN a job is enqueued
- WHEN the analysis status is observed
- THEN the value is one of `processing`, `analyzing`, `completed`, or `failed`
- AND no additional queued/pending status is introduced

### Requirement: Graceful degradation when Redis is unavailable

If Redis is unreachable during enqueue, the system MUST return an HTTP error indicating the queue is unavailable so the client can retry. The system MUST NOT mark the analysis as `failed` solely because the enqueue failed — the database state stays valid for a subsequent retry.

#### Scenario: Enqueue returns 503 when Redis is down

- GIVEN Redis is unreachable
- WHEN the analysis service attempts to enqueue
- THEN the HTTP request fails with a service-unavailable response
- AND the analysis status is not mutated by the failed enqueue

#### Scenario: Successful enqueue after Redis recovery

- GIVEN a previous enqueue failed because Redis was down
- WHEN the client retries and Redis is reachable again
- THEN the analysis is enqueued and processed normally

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
