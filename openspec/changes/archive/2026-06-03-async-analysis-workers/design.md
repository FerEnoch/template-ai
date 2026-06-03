# Design: Async Analysis Workers

## Technical Approach

Decouple AI inference from the HTTP request lifecycle using BullMQ + Redis. Phase 1 (atomic `processing → analyzing` transition) stays identical. Phase 2 stops calling `documentAnalysisService.analyze()` inline and instead enqueues a job onto `analysis-queue`, returning immediately. Phase 3 logic (text extraction, entity insertion, status update, error/retry handling) moves wholesale into a new in-process `AnalysisProcessor` (`WorkerHost`). Status flow is unchanged (`processing → analyzing → completed|failed`), so the frontend polling contract is untouched. Implements specs `async-analysis-worker` and `local-operational-infra`.

## Architecture Decisions

| Decision | Choice | Alternatives rejected | Rationale |
|----------|--------|-----------------------|-----------|
| Job payload shape | `{ analysisResultId, documentId, ownerId, filePath }` | Pass full document/AI args | Worker fetches nothing over HTTP; `filePath` lets it skip a DB hit, but `documentId`+`ownerId` allow re-fetch under RLS if needed (mirrors assist-ai `ParseJobPayload.filePath`) |
| Where Phase 3 lives | Fully inside `AnalysisProcessor.process()` | Split service helper called by both | Single owner of write path; matches spec "worker persists entities + sets status" |
| Transaction handling in worker | Reuse `PostgresService.withOwnerTransaction(ownerId, …)` | New worker DB pool / TypeORM | Same RLS-scoped pattern as current Phase 3; assist-ai uses TypeORM but template-ai is raw `pg` — FOLLOW existing pattern |
| Services injected into processor | `DocumentAnalysisService`, `PostgresService` (repos instantiated per-tx as today) | Inject repositories directly | Repos are `new R(client)` per transaction; cannot be DI singletons |
| Document fetch | Worker re-fetches via `DocumentsRepository.findById` inside its own tx (the query currently in Phase 2) | Trust `filePath` from payload only | Keeps RLS resolution server-side; `filePath` in payload is an optimization, the worker still owns the read |
| Error classification | Transient (AI/network) → throw to trigger BullMQ retry (3 attempts, exp backoff 5s). Terminal (final attempt OR non-retryable) → set status `failed`, preserve error | Mark failed on first error | `DocumentAnalysisService.analyze()` returns `{success,error}` not throws; processor must THROW on retryable to engage BullMQ, but mark `failed` only when `job.attemptsMade + 1 >= attempts` |
| Redis env validation | Add `REDIS_HOST`/`REDIS_PORT` to `getApiEnv()` fail-fast validator | Read `process.env` inline in module | Spec requires startup to fail when missing; project already validates env eagerly in `main.ts` |
| BullModule connection | `BullModule.forRoot({ connection: { host, port } })` reading validated env | `forRootAsync` | Matches assist-ai; env already validated synchronously |
| `@nestjs/bullmq` version | `11.0.4` (peer `^10||^11`) + `bullmq@5.28.0` | Older 10.x line | Verified peer compat with NestJS 10; same versions proven in assist-ai |

## Data Flow

```
HTTP GET /api/analysis/:id
  │
  ▼
AnalysisService.getFullResult()
  │  Phase 1 (short tx): increment progress / detect terminal
  │
  ├─ progress<100 or terminal ──────────────► return result (unchanged)
  │
  └─ "needs-ai" (won transition to analyzing)
        │  Phase 2: queue.add('analyze', {analysisResultId,documentId,ownerId,filePath})
        │           (Redis down → throw 503, status NOT mutated)
        ▼
     return terminal (status=analyzing, entities=[])   ◄── HTTP returns <200ms

  ── async, off the request thread ──────────────────────────────────────
        ▼
AnalysisProcessor.process(job)   @Processor('analysis-queue', {concurrency:2})
  │  1. withOwnerTransaction → DocumentsRepository.findById (re-fetch / RLS)
  │  2. DocumentAnalysisService.analyze(filePath)        (20–30s, off HTTP)
  │  3. withOwnerTransaction (short): success → bulkInsert entities,
  │       saveExtractedText, updateStatus('completed')
  │     failure → throw if retryable & attempts remain (BullMQ re-queues)
  │             → else incrementRetryCount + updateStatus('failed')
  ▼
Frontend polling GET /:id/status sees analyzing → completed|failed
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `apps/api/package.json` | Modify | Add `@nestjs/bullmq@11.0.4`, `bullmq@5.28.0` to dependencies |
| `apps/api/src/config/env.ts` | Modify | Add `REDIS_HOST` (required) + `REDIS_PORT` (required, valid port) to `ApiEnv` + fail-fast parsers |
| `apps/api/src/app.module.ts` | Modify | Add `BullModule.forRoot({ connection: { host: env.REDIS_HOST, port: env.REDIS_PORT } })` |
| `apps/api/src/analysis/analysis.queue.ts` | Create | Export `ANALYSIS_QUEUE_NAME = 'analysis-queue'`, `AnalysisJobPayload` interface, `ANALYSIS_RETRY_POLICY` |
| `apps/api/src/analysis/analysis.module.ts` | Modify | `BullModule.registerQueue({ name, defaultJobOptions:{attempts:3,backoff:{type:'exponential',delay:5000},removeOnComplete:50,removeOnFail:200} })`; add `AnalysisProcessor` provider |
| `apps/api/src/analysis/analysis.service.ts` | Modify | Inject `@InjectQueue(ANALYSIS_QUEUE_NAME)`; Phase 2 → `queue.add('analyze', payload)` then return terminal; remove inline `analyze()` + Phase 3 block; keep `fetchDocument` only to source `filePath` for payload (or drop and let worker fetch) |
| `apps/api/src/analysis/analysis.processor.ts` | Create | `WorkerHost` subclass; holds Phase 3 logic + worker-side document fetch + error/retry classification |
| `apps/api/src/main.ts` | Modify | `REQUEST_TIMEOUT_MS = 30 * 1000`; keep keepAlive/headers as-is |
| `compose.dev.yaml` | Modify | Add `redis:7-alpine` service: port `6379:6379`, healthcheck (`redis-cli ping`), named volume; NOT in `compose.yaml` |
| `.env.dev.example` | Modify | Add `REDIS_HOST=localhost`, `REDIS_PORT=6379` |
| `.env.dev` | Modify | Add same two vars |
| `apps/api/src/analysis/analysis.processor.spec.ts` | Create | Unit tests for processor (mock `DocumentAnalysisService`, `PostgresService`) |
| `apps/api/src/analysis/analysis.service.spec.ts` | Modify | Assert `queue.add` called with payload; assert no inline AI call; mock `Queue` |
| `apps/api/src/main.process.spec.ts` | Modify | Add `REDIS_HOST`/`REDIS_PORT` to spawned env so startup succeeds; (timeout value covered by inspection, not the process spec) |

## Interfaces / Contracts

```typescript
// apps/api/src/analysis/analysis.queue.ts
export const ANALYSIS_QUEUE_NAME = "analysis-queue";

export interface AnalysisJobPayload {
  analysisResultId: string;   // PK of analysis_results row (Phase 1 winner)
  documentId: string;         // for worker re-fetch under RLS
  ownerId: number;            // withOwnerTransaction scope (currently 0)
  filePath: string | null;    // optimization: avoid a DB round-trip
}

export const ANALYSIS_RETRY_POLICY = {
  attempts: 3,
  backoff: { type: "exponential" as const, delay: 5_000 },
  removeOnComplete: 50,
  removeOnFail: 200,
} as const;
```

```typescript
// apps/api/src/analysis/analysis.processor.ts (shape)
@Processor(ANALYSIS_QUEUE_NAME, { concurrency: 2 })
export class AnalysisProcessor extends WorkerHost {
  constructor(
    private readonly postgres: PostgresService,
    private readonly documentAnalysisService: DocumentAnalysisService,
  ) { super(); }

  async process(job: Job<AnalysisJobPayload>): Promise<void> {
    // fetch doc (RLS) → analyze() → on success: tx write entities + completed
    // on failure: if retryable && attemptsMade+1 < attempts → throw (retry)
    //             else incrementRetryCount + updateStatus('failed')
  }
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Processor happy path: analyze called, entities inserted, status `completed` | Mock `DocumentAnalysisService.analyze`→success; mock `PostgresService` query-routing (reuse existing spec's mock factory) |
| Unit | Processor terminal failure on last attempt: `incrementRetryCount` + status `failed`, error preserved | Mock `analyze`→`{success:false}`, `job.attemptsMade = 2` |
| Unit | Processor retryable failure with attempts remaining: re-throws (no `failed` write) | `analyze`→failure, `job.attemptsMade = 0`, expect throw |
| Unit | Service Phase 2 enqueues instead of calling AI | Mock `Queue.add`; assert called with `AnalysisJobPayload`; assert `documentAnalysisService.analyze` NOT called |
| Unit | Service enqueue failure surfaces (Redis down) without mutating status | `queue.add` rejects → error propagates; assert no `updateStatus('failed')` |
| Process | API boots with Redis env present | Add `REDIS_HOST`/`REDIS_PORT` to `main.process.spec.ts` spawn env |
| Manual | `make dev` starts Redis healthy; `GET /:id` <200ms at progress 100 | Local verification per success criteria |

## Migration / Rollout

No DB schema changes — `analysis_results` columns (`status`, `retry_count`, `error_message`, `extracted_text`) already exist. Rollback = git revert (restores inline Phase 2/3, removes BullMQ deps, restores 10-min timeout, removes Redis from `compose.dev.yaml`). No data to undo. Redis is dev-only opt-in; production wiring is out of scope.

## Open Questions

- [ ] `ownerId` is hardcoded `0` throughout the current code. Confirm the payload should carry `0` until multi-tenant auth lands (assumed yes — matches existing behavior).
- [ ] Should `getFullResult` keep `fetchDocument` to populate `filePath` in the payload, or drop it entirely and let the worker fetch (one less DB call on the HTTP path)? Recommended: drop from HTTP path, worker fetches — but `filePath` stays in payload as optional optimization for callers that already have it. Decide in tasks.
