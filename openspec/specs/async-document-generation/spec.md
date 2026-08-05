# async-document-generation Specification

> **Status: Phase 2 (Deferred)** — This spec is planned and reviewed but NOT yet implemented. It is archived here as a design reference for the future separate change. See `openspec/changes/archive/2026-07-10-fix-generation-delay-ui-message/` for context.

## Purpose

Decouple document generation from the HTTP request lifecycle so `POST /cases/:id/generate` returns immediately and AI work runs in the background. The frontend polls for status changes, and the user may navigate away and return while generation continues server-side. **Phase 2 — planned here; implemented as a separate change after Phase 1.**

## Requirements

| # | Requirement | Summary |
|---|------------|---------|
| R1 | 202 Accepted endpoint contract | POST returns 202 immediately; generation moves to background |
| R2 | Background generation processing | AI work runs in a queue worker, reusing existing retry logic |
| R3 | Frontend status polling | Client polls GET /cases/:id every N seconds until terminal status |
| R4 | Status lifecycle | borrador → generating → generado |
| R5 | Navigate-away resilience | Generation continues server-side; returning user sees current status |
| R6 | requestTimeout reversion | Backend timeout reverts to 30s (Phase 1 300s accommodation removed) |

### Requirement: 202 Accepted endpoint contract

`POST /cases/:id/generate` MUST validate the case is in `borrador` status, enqueue a generation job, transition the case to `generating`, and return `202 Accepted` with the updated Case object. It MUST NOT block on AI completion.

#### Scenario: Endpoint returns immediately

- GIVEN a case in `borrador` status
- WHEN the user clicks "Generar documento"
- THEN `POST /cases/:id/generate` returns `202 Accepted` within 2 seconds
- AND the case status in the response is `generating`

#### Scenario: Idempotent on already-generating case

- GIVEN a case already in `generating` status
- WHEN `POST /cases/:id/generate` is called again
- THEN the endpoint returns `202 Accepted` without enqueuing a duplicate job

### Requirement: Background generation processing

A queue worker MUST consume generation jobs. The worker MUST call the existing document generation service with retry logic, persist the `generatedText`, and transition the case to `generado` on success or `failed` on terminal failure. The worker MUST reuse the existing `DocumentGenerationService` retry behavior (3 attempts, 1s/3s backoff).

#### Scenario: Worker completes generation

- GIVEN a job is enqueued for a valid case
- WHEN the worker processes it
- THEN text is generated via the AI service, persisted, and status becomes `generado`

#### Scenario: Worker exhausts retries

- GIVEN the AI service fails on all 3 retry attempts
- WHEN the worker exhausts retries
- THEN status becomes `failed` with the last error message preserved

### Requirement: Frontend status polling

The frontend MUST poll `GET /cases/:id` at a fixed interval while status is `generating`. The poll SHALL stop when status becomes `generado` or `failed`. On `generado`, the user SHALL be redirected to `/preview/[id]`. On `failed`, an error SHALL be surfaced.

#### Scenario: Poll detects completion

- GIVEN the case status is `generating` and the frontend is polling
- WHEN a poll response returns status `generado`
- THEN polling stops and the user is redirected to `/preview/[id]`

#### Scenario: Poll detects failure

- GIVEN the case status is `generating` and the frontend is polling
- WHEN a poll response returns status `failed`
- THEN polling stops and the error is surfaced via `setGenerationError`

### Requirement: Status lifecycle

The case status MUST follow the lifecycle: `borrador` → `generating` (on enqueue) → `generado` (on success) or `failed` (on terminal failure). The `generating` status MUST be a first-class value in the Case schema and contracts.

#### Scenario: Full lifecycle

- GIVEN a new case in `borrador`
- WHEN generation is requested → status is `generating`
- WHEN the worker completes → status is `generado`
- THEN the UI reflects each transition

#### Scenario: Archiving during generation

- GIVEN a case is `generating`
- WHEN the user archives it through another flow
- THEN the worker MUST check status before writing results and skip if already `archivado`

### Requirement: Navigate-away resilience

The user MUST be able to navigate away from `/nuevo/[id]` during generation and return later. On return, the page MUST fetch the current case status and show the appropriate state: spinner if still `generating`, preview link if `generado`.

#### Scenario: Return during generation

- GIVEN the user clicked "Generar" and navigated away
- WHEN they return to `/nuevo/[id]`
- THEN the page fetches the case and shows the generation spinner if status is still `generating`

#### Scenario: Return after completion

- GIVEN generation completed while the user was on another page
- WHEN they return to `/nuevo/[id]`
- THEN the page fetches `generado` status and either auto-redirects or shows a "Ver documento" link

### Requirement: requestTimeout reversion

The NestJS server SHALL revert `server.requestTimeout` to `30_000` ms as required by `local-operational-infra`. This reversion is safe because Phase 2 eliminates the synchronous long-running endpoint — all generation work runs in the background queue.

#### Scenario: Timeout back at 30s

- GIVEN Phase 2 is deployed
- WHEN the API server starts
- THEN `server.requestTimeout` is 30 seconds
- AND the 300s Phase 1 accommodation is removed from `apps/api/src/main.ts`
