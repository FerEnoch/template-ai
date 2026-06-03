# Tasks: Async Analysis Workers

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~450–550 |
| 400-line budget risk | Medium |
| Chained PRs recommended | Yes (force-chained) |
| Suggested split | PR 1 → PR 2 → PR 3 (stacked-to-main) |
| Delivery strategy | force-chained |
| Chain strategy | stacked-to-main |
| Session review budget | 800 lines |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Infra: deps, env, Redis compose, spec env | PR 1 → main | No code wired; suite stays green |
| 2 | Queue + `AnalysisProcessor` + `BullModule` wiring | PR 2 → main | Service inline; processor idle, tested |
| 3 | Service refactor (Phase 2 → `queue.add`) + 30s timeout | PR 3 → main | Async live; revert PR 3 to roll back |

## Phase 1: Infrastructure (PR 1)

- [x] 1.1 [RED] `apps/api/src/config/env.spec.ts` (create) — `getApiEnv()` throws naming `REDIS_HOST`; out-of-range `REDIS_PORT` rejected
- [x] 1.2 [GREEN] `apps/api/src/config/env.ts` — add `REDIS_HOST` (required) + `REDIS_PORT` to `ApiEnv`
- [ ] 1.3 `apps/api/package.json` — add `@nestjs/bullmq@11.0.4` + `bullmq@5.28.0`
- [x] 1.4 `compose.dev.yaml` — `redis` service (`redis:7-alpine`, port `6379:6379`, `redis-cli ping` healthcheck)
- [ ] 1.5 `.env.dev.example` + `.env.dev` — add `REDIS_HOST=localhost`, `REDIS_PORT=6379`
- [ ] 1.6 `apps/api/src/main.process.spec.ts` — add `REDIS_HOST`/`REDIS_PORT` to both spawn env blocks
- [ ] 1.7 Verify: `pnpm install`; `pnpm --filter @template-ai/api test` green; `redis-cli ping` → `PONG`

## Phase 2: Queue + Processor (PR 2)

- [x] 2.1 [RED] `analysis.processor.spec.ts` (create) — happy path; terminal fail (`attemptsMade=2`); retryable (`attemptsMade=0`)
- [x] 2.2 [GREEN] `analysis.queue.ts` (create) — export `ANALYSIS_QUEUE_NAME`, `AnalysisJobPayload`, `ANALYSIS_RETRY_POLICY`
- [x] 2.3 [GREEN] `analysis.processor.ts` (create) — `@Processor(ANALYSIS_QUEUE_NAME, {concurrency:2})` `WorkerHost`; `process(job)` re-fetches doc, calls `analyze()`, writes entities on success, throws on retryable failure or marks `failed` on terminal
- [x] 2.4 `app.module.ts` — add `BullModule.forRoot({ connection: { host: env.REDIS_HOST, port: env.REDIS_PORT } })`
- [x] 2.5 `analysis.module.ts` — add `BullModule.registerQueue({ name, defaultJobOptions: ANALYSIS_RETRY_POLICY })` + `AnalysisProcessor` provider
- [x] 2.6 Verify: processor spec green; `pnpm typecheck`; full suite green

## Phase 3: Service Refactor + Timeout (PR 3)

- [ ] 3.1 [RED] `analysis.service.spec.ts` (modify) — `needs-ai`: `queue.add('analyze', payload)` called; `analyze()` NOT called; returns terminal
- [ ] 3.2 [RED] `analysis.service.spec.ts` (extend) — `queue.add` rejects → error propagates; no `updateStatus('failed')`
- [x] 3.3 [GREEN] `analysis.service.ts` — inject `@InjectQueue(ANALYSIS_QUEUE_NAME) queue: Queue`; replace Phase 2 with `await this.queue.add('analyze', payload)` then return terminal; remove inline `analyze()` + Phase 3 tx + `fetchDocument`
- [x] 3.4 `main.ts` — `REQUEST_TIMEOUT_MS = 30 * 1000`; keep keepAlive/headers
- [ ] 3.5 Verify: full `pnpm --filter @template-ai/api test` green; manual `make dev` → `GET /:id` <200ms → status `processing → analyzing → completed`; `make test-db-up` does NOT start Redis

## Phase 4: Cleanup

- [ ] 4.1 `analysis.service.ts` — drop unused `DocumentAnalysisService` injection + `EntitiesRepository`/`DocumentsRepository` imports
- [ ] 4.2 Final: `pnpm install && pnpm typecheck && pnpm test --filter @template-ai/api`
