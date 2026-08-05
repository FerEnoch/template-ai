# Tasks: Fix Generation Delay UI Message

## Review Workload Forecast

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: Low

Est. changed lines: ~95 (Phase 1). Delivery strategy: chained (force-chained, per user). Split: PR 1 → PR 2, both target `main`, no shared files.

## Phase 1: Backend Timeout & Proxy Config (PR 1 → `main`)

- [x] 1.1 `apps/api/src/main.ts`: set `REQUEST_TIMEOUT_MS = 300 * 1000`; update comment to 300s (2× worst-case AI retry budget ≈ 148s); add `// TODO(async-document-generation): revert to 30s when Phase 2 lands`. Verify: `pnpm --filter @template-ai/api test` passes.
- [x] 1.2 `apps/web/next.config.ts`: add `experimental: { proxyTimeout: 300_000 }` to `nextConfig` with a one-line comment. Verify: `pnpm --filter @template-ai/web build` passes.
- [x] 1.3 Manual dev: spinner survives past 30s without proxy 502. Commit: `fix(api,web): raise generation timeouts to 300s for long AI calls (Phase 1)` — both files together.

## Phase 1: Frontend Latency-Aware UX (PR 2 → `main`)

> R3/R4/R5 already implemented per design — verify, don't re-implement. R1 (spinner) and R2 (502/500) are the only new UX work. Spanish copy: see `design.md`.

- [x] 2.1 `apps/web/src/lib/api/cases.ts`: added 502 (proxy-drop) and 500 (server-load) Spanish messages to `fallbackMessageForStatus`. No change to `parseErrorResponse`.
- [x] 2.2 `apps/web/src/components/case/CaseStickyBar.tsx`: changed `isGenerating` text to `"Generando documento... Esto puede tomar hasta 2 minutos."` (actual spinner location per code read).
- [x] 2.3 `apps/web/src/app/nuevo/[templateId]/page.tsx`: verified `handleGenerate` catch (lines ~108–143) does `fetchCase` → redirect `/preview/[id]` on `generado`, `/biblioteca` on `archivado`, else `setGenerationError`. `CaseStickyBar.tsx` verified to render `error` prop verbatim. ✅ No code changes per PR 2 scope.
- [x] 2.4 `apps/web/src/lib/api/__tests__/cases.test.ts`: added direct `fallbackMessageForStatus` tests for 502 and 500, plus `parseErrorResponse` HTML 502 fallback test. Existing 500/502 `parseErrorResponse` assertions updated to match new copy.
- [x] 2.5 `openspec/changes/fix-generation-delay-ui-message/specs/local-operational-infra/spec.md`: "Phase 1 synchronous-generation exception" scenario already present — verified, no edit needed.
- [x] 2.6 Commit: `fix(web): add latency-aware 502/500 messages and generation time expectation` — bundles `cases.ts`, `CaseStickyBar.tsx`, `cases.test.ts` as one work unit. Manual: API killed mid-gen → 502 latency message; API killed post-success → catch-recovery to `/preview/[id]`.

## Phase 2: Async Document Generation (DEFERRED — separate change)

> Do NOT implement here. Maps to `specs/async-document-generation/spec.md` R1–R6.

- [ ] D.1 DB migration: add `generando` + `failed` to `case_status`; nullable `generation_error TEXT`.
- [ ] D.2 Schema (`packages/contracts/src/schemas.ts`): extend `CaseStatus` with `"generando"` and `"failed"`.
- [ ] D.3 API (`cases.controller.ts`): `POST /cases/:id/generate` returns `202` + Case (`status: "generando"`); validates `borrador`; idempotent on `generando`.
- [ ] D.4 Service (`cases.service.ts`): rename `generate` → `enqueueGeneration`; `borrador → generando` sync, enqueue, return; worker reuses `DocumentGenerationService` retry.
- [ ] D.5 Queue: `apps/api/src/cases/generation-queue/` mirroring `analysis-queue` (BullMQ, in-process worker, ≤2 concurrency, RLS via `withOwnerTransaction(userId)`); on terminal failure `generando → failed`, persist `generation_error`.
- [ ] D.6 Polling (`apps/web/src/lib/api/cases.ts`): add `pollCaseStatus(id, { intervalMs, timeoutMs })` → `Promise<Case>`.
- [ ] D.7 Navigate-away (`nuevo/[templateId]/page.tsx`): on mount fetch existing case; resume spinner if `generando`, redirect if `generado`.
- [ ] D.8 Timeout reversion (`apps/api/src/main.ts`): revert to `30 * 1000`; remove `TODO(async-document-generation)`; update `local-operational-infra` spec.

## Final Verification (before apply)

- [x] All `pnpm typecheck` / `test` / `lint` clean (232 web tests passed, incl. 3 new cases); `local-operational-infra` spec documents the Phase 1 timeout exception
- [ ] Manual: `/nuevo/[id]` → Generar → spinner shows 2-min copy, doc lands at `/preview/[id]` after ~48s; API killed mid-gen → 502 latency message (not "error inesperado"); API killed post-success → catch-recovery to `/preview/[id]`
