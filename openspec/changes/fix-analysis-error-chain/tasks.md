# Tasks: Fix Analysis Error Chain

## Review Workload Forecast

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: Low
Estimated changed lines: ~140 (55 backend + 85 frontend)

| Unit | PR | Base |
|------|----|------|
| Backend (B4+B1+B2+B3+tests) | PR #1 | `main` |
| Frontend (B5+B6+race guard) | PR #2 | `main` |

---

## Phase 1: PR #1 — Backend Error Resilience

### Task 1.1 — B4: Token budget
- [ ] 1.1.1 `impl` `apps/api/src/config/ai.ts` — read `AI_MAX_TOKENS`, default 8192, throw at import if `< 8192`
- [ ] 1.1.2 `test` `apps/api/src/config/ai.spec.ts` — default 8192, env override 16384, reject 4096
- [ ] 1.1.3 `verify` `pnpm --filter api test config/ai.spec.ts`; API fails to boot with `AI_MAX_TOKENS=4096`
- **Depends on**: none

### Task 1.2 — B1: JSON parse safety
- [ ] 1.2.1 `impl` `open-router.service.ts:192` — wrap `JSON.parse` in try/catch; strip ` ```json ` fences; throw `OpenRouterError("INVALID_RESPONSE")` on SyntaxError
- [ ] 1.2.2 `test` `open-router.service.spec.ts` — malformed → `INVALID_RESPONSE`; markdown-fenced parses cleanly
- [ ] 1.2.3 `verify` `pnpm --filter api test ai/open-router.service.spec.ts`
- **Depends on**: 1.1

### Task 1.3 — B2: SyntaxError classification safety net
- [ ] 1.3.1 `impl` `open-router.service.ts` catch block — add SyntaxError→`INVALID_RESPONSE` guard after rethrow
- [ ] 1.3.2 `test` `open-router.service.spec.ts` — SyntaxError from any path maps to `INVALID_RESPONSE`
- [ ] 1.3.3 `verify` "SyntaxError maps to INVALID_RESPONSE" scenario passes
- **Depends on**: 1.2 (same file, same catch block)

### Task 1.4 — B3: Expanded retry policy
- [ ] 1.4.1 `impl` `document-analysis.service.ts:116` — retry on `RATE_LIMIT | NETWORK_ERROR | INVALID_RESPONSE`; 3 attempts; 1s/3s backoff
- [ ] 1.4.2 `test` `document-analysis.service.spec.ts` — retry 3 codes; no retry `CONFIG_ERROR`; max 3 attempts
- [ ] 1.4.3 `verify` all 4 `ai-error-resilience` retry scenarios pass
- **Depends on**: 1.2 + 1.3

**PR #1 acceptance**: 4 backend test suites green; no SyntaxError→NETWORK_ERROR; API rejects `AI_MAX_TOKENS<8192` at boot.

---

## Phase 2: PR #2 — Frontend State Fix

> B5 + B6 share `pollForAnalysis` — one commit, one PR.

### Task 2.1 — B5: Failed state handling
- [ ] 2.1.1 `impl` `page.tsx` failed branch — add `setAnalysisResult(result)` before `setError`
- [ ] 2.1.2 `verify` `pnpm --filter web tsc --noEmit`; manual: failed flips `isProcessing=false`
- **Depends on**: none (bundled with 2.2)

### Task 2.2 — B6: Polling endpoint + race guard
- [ ] 2.2.1 `impl` `page.tsx:121-176` — poll `GET /:id/status` (read-only); call `GET /:id` only to advance via `triggerProgress()`; add `isStaleRef`; fire initial trigger
- [ ] 2.2.2 `verify` `pnpm --filter web tsc --noEmit`; manual: 3-5 page PDF completes; rapid unmount clean; CI scan finds no `fetch.*api/analysis/${id}\`` inside `setInterval`
- **Depends on**: 2.1 (same function — split commits, not PRs)

**PR #2 acceptance**: document-preview spec scenarios green; 75% freeze eliminated; no duplicate Phase 1 logs.

---

## Phase 3: Cross-PR Verification

- [ ] 3.1 `verify` `pnpm --filter api test` + `pnpm --filter web test` — both pass
- [ ] 3.2 `verify` E2E: 3-5 page PDF completes; malformed AI → 3 retries → `failed`
- [ ] 3.3 `verify` no `SyntaxError` unhandled exceptions in API logs
- [ ] 3.4 `docs` update `CHANGELOG.md` with both PRs under Fixed
