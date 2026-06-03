# Proposal: Async Analysis Workers

## Intent

`GET /api/analysis/:id` blocks 20–30s for OpenRouter AI inference, holding HTTP connections open per concurrent user. The 10-minute `requestTimeout` is a band-aid. Decouple AI processing from HTTP using BullMQ + Redis for non-blocking, scalable analysis.

## Scope

### In Scope
- BullMQ queue + in-process `WorkerHost` processor
- Redis service in compose files with healthcheck
- Phase 2 → `queue.add()`; Phase 3 moves to processor
- `requestTimeout` 10min → 30s; Redis env vars; unit tests

### Out of Scope
- Frontend changes (polling handles all statuses already)
- Separate worker app, Redis clustering/production config, queue dashboard
- Contract status enum changes ("analyzing" covers queued state)

## Capabilities

### New Capabilities
- `async-analysis-worker`: BullMQ queue, `@Processor` worker, job payload, retry policy, concurrency

### Modified Capabilities
- `local-operational-infra`: Add Redis to compose/env/healthcheck; relax non-goal excluding Redis

## Approach

1. `BullModule.forRoot()` in `app.module.ts` with Redis from env
2. `BullModule.registerQueue()` in `analysis.module.ts` — 3 attempts, exp backoff 5s
3. `analysis.service.ts`: Phase 2 becomes `queue.add('analyze', payload)`, returns immediately
4. New `analysis.processor.ts`: `WorkerHost` runs AI + writes entities (Phase 3 logic)
5. Status flow unchanged: `processing → analyzing → completed|failed` — zero frontend impact

Phase 1 (atomic transition) stays identical. Worker calls `DocumentAnalysisService.analyze()`, writes entities in short transaction. Reference: `assist-ai` patterns.

## Affected Areas

| Area | Impact |
|------|--------|
| `analysis/analysis.processor.ts` | New — worker host |
| `analysis/analysis.service.ts` | Modified — enqueue replaces blocking AI |
| `analysis/analysis.module.ts` | Modified — queue + processor registration |
| `app.module.ts` | Modified — `BullModule.forRoot` |
| `main.ts` | Modified — timeout → 30s |
| `package.json` (api) | Modified — `@nestjs/bullmq`, `bullmq` |
| `compose.yaml` / `compose.dev.yaml` | Modified — Redis 7-alpine |
| `.env.dev.example` | Modified — Redis vars |
| `analysis/*.spec.ts` | New/Modified — tests |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Redis unavailable | Low | 503 on enqueue failure; frontend retries |
| Worker crash mid-job | Low | BullMQ retries; atomic guard prevents duplicates |
| Event loop contention | Low | I/O-bound AI calls; `concurrency: 2`; extractable later |

## Rollback Plan

Git revert: restores synchronous Phase 2+3, removes BullMQ, restores 10min timeout, removes Redis from compose. No DB changes to undo.

## Dependencies

- `@nestjs/bullmq`, `bullmq` packages; Redis 7+ (`redis:7-alpine`)

## Success Criteria

- [ ] `GET /:id` returns <200ms at progress=100
- [ ] Worker processes AI + writes entities async
- [ ] Frontend polling unchanged, correct transitions
- [ ] Worker retries on failure (3 attempts, exp backoff)
- [ ] `make dev` starts Redis; `requestTimeout` at 30s
- [ ] Tests cover enqueue + processor paths
