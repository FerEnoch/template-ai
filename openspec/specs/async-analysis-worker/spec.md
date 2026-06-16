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

An in-process worker MUST consume `analysis-queue` jobs. For each job, the worker MUST extract document text, call the AI service, persist the resulting entities, and set the analysis status to `completed`. The worker MUST reuse the existing AI analysis service so behavior matches the previous synchronous path.

#### Scenario: Happy path completes the job

- GIVEN a job is on the queue with a valid document
- WHEN the worker processes it
- THEN text is extracted, the AI service is called, entities are written to the database
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
