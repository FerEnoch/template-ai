# Tasks: Regenerate Document Error Fix

## Review Workload Forecast

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low
Estimated changed lines: ~150–210
Delivery strategy: single-pr-default

## Phase 1: Backend logging R7 (RED)

- [ ] 1.1 In `apps/api/src/cases/__tests__/document-generation.service.spec.ts`, add `describe("error logging")` asserting `Logger.prototype.error` is called with the stack when `generateDocument` throws `OpenRouterError(…, "INVALID_RESPONSE")` 3× (exhausted retries).
- [ ] 1.2 In `apps/api/src/ai/open-router.service.spec.ts`, add `describe("structured error logging")` asserting `Logger.prototype.error` is called with status + body fragment (≤200 chars) for 401/404/429/status>0/status=0 branches; never contain the user prompt.

## Phase 2: Backend logging R7 (GREEN)

- [ ] 2.1 In `apps/api/src/ai/document-generation.service.ts` (lines 99–110): add `this.logger.error("Document generation failed", error instanceof Error ? error.stack : String(error));` before `return { success: false, ... }`.
- [ ] 2.2 In `apps/api/src/ai/open-router.service.ts` (lines 541–578): before each `throw new OpenRouterError(...)` for the 401/404/429/status>0/status=0 branches, call `this.logger.error(...)` with status + body fragment ≤200 chars; never include `userPrompt`.

## Phase 3: Spanish 502 + errorType R5 (RED)

- [ ] 3.1 In `apps/api/src/cases/__tests__/cases.service.spec.ts`, mock `generationService.generate` to return `{ success: false, errorType: "NETWORK_ERROR" }` and `{ success: false }`; assert `generate` throws `BadGatewayException` whose `getResponse()` payload has a Spanish message with `errorType: "NETWORK_ERROR"` or `"UNKNOWN"`.

## Phase 4: Spanish 502 + errorType R5 (GREEN)

- [ ] 4.1 In `apps/api/src/cases/cases.service.ts` (lines 282–289): replace the English `BadGatewayException("Document generation failed. Please try again.")` with `BadGatewayException({ message: "No se pudo contactar al servicio de IA. Intentá nuevamente.", errorType: genResult.errorType ?? "UNKNOWN" })`. Run api tests.

## Phase 5: `parseErrorResponse` + `ApiError.errorType` R6 (RED)

- [ ] 5.1 Create `apps/web/src/lib/api/__tests__/cases.test.ts` with three tests: (a) `new Response("Internal Server Error", { status: 500 })` → Spanish fallback; (b) JSON `{errorType:"NETWORK_ERROR"}` at 502 → message + `ApiError.errorType` set; (c) `new Response("Bad input", { status: 400 })` → raw text returned.

## Phase 6: `parseErrorResponse` + `ApiError.errorType` R6 (GREEN)

- [ ] 6.1 In `apps/web/src/lib/api/cases.ts`: add optional `public readonly errorType?: string` to `ApiError`; export `parseErrorResponse`.
- [ ] 6.2 Gate `parseErrorResponse`'s raw-short-text branch to `status < 500`; for 5xx use `fallbackMessageForStatus(status)`; for JSON bodies extract `errorType`.
- [ ] 6.3 Update `handleResponse` to construct `new ApiError(message, response.status, errorType)`.

## Phase 7: Retry button + Spanish banner R4 + R6 (RED)

- [ ] 7.1 In preview RTL test (create `apps/web/src/app/preview/[caseId]/page.test.tsx` if absent): (a) mock `generateCase` reject→resolve, click "Reintentar", assert a second `generateCase(caseId)` call (NOT `window.location.reload()`); (b) Spanish message renders in banner with `errorType` visible when present in `ApiError`.

## Phase 8: Retry button + Spanish banner R4 + R6 (GREEN)

- [ ] 8.1 In `apps/web/src/app/preview/[caseId]/page.tsx`: add `regenError` state separate from `error`; `handleRegenerate` writes to `regenError`; `loadCase` writes to `error`.
- [ ] 8.2 Replace `onClick={() => window.location.reload()}` (line 84) with: `loadCase()` for page-load errors, `handleRegenerate()` for regenerate errors. Never call `reload`.
- [ ] 8.3 Render a Spanish banner when `regenError` is set, including `ApiError.errorType` as a small monospace label; keep preview tree mounted on regenerate error.

## Phase 9: Verify

- [ ] 9.1 Run api+web tests, `pnpm typecheck`, `pnpm lint` — all green.
- [ ] 9.2 Manual smoke on `/preview/[caseId]`: forced AI failure shows Spanish banner with `errorType`; "Reintentar" triggers a second `POST /api/cases/:id/generate` (no full reload).
