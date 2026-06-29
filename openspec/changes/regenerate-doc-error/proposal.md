# Proposal: Regenerate Document Error Fix

## Intent

The "Regenerar" button on `/preview/[caseId]` returns a generic English "Internal Server Error" **and** produces no diagnostic logs in either frontend or backend. Two-part fix: (a) user-facing error UX, (b) restore diagnostic logging in the AI pipeline.

## Root Cause

Tracing `POST /api/cases/:id/generate` end-to-end:

| # | File:line | Bug |
|---|---|---|
| 1 | `apps/api/src/ai/document-generation.service.ts:99-110` | `try/catch` converts every OpenRouter exception to `{ success: false, ... }` **without `this.logger.error()`**. Full stack + response body discarded. |
| 2 | `apps/api/src/ai/open-router.service.ts:541-578` | `generateDocument` builds `OpenRouterError` but never logs status / body before throwing. |
| 3 | `apps/api/src/cases/cases.service.ts:286-288` | 502 message is **English**, not Spanish. No `errorType` in body. |
| 4 | `apps/web/src/lib/api/cases.ts:85-91` | Plain-text `"Internal Server Error"` body bypasses Spanish `fallbackMessageForStatus(500)`. |
| 5 | `apps/web/src/app/preview/[caseId]/page.tsx:75-92` | "Reintentar" button does `window.location.reload()` — not a true regenerate retry. |

## Scope

**In**: `this.logger.error()` with full stack in `DocumentGenerationService.generate()` catch; structured logging in `OpenRouterService.generateDocument()` (status, code, body fragment ≤200 chars; never user form data); Spanish 502 in `CasesService.generate()` with `errorType` in body; plain-text 500 → Spanish fallback in `parseErrorResponse`; true regenerate retry button; TDD with failing tests driving each fix.

**Out**: BullMQ queue, WebSocket progress, AI model/prompt/token changes, `new-case-flow` happy-path changes.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `document-generation` (`openspec/changes/new-case-flow/specs/document-generation/spec.md`) — add `R7` (structured logging); update `R5` (Spanish + `errorType`)
- `case-document-preview` (`openspec/changes/new-case-flow/specs/case-document-preview/spec.md`) — add `R6` (regenerate error UX)

## Approach

**TDD order** — 3 failing tests first:
1. `DocumentGenerationService.generate()` with mocked `INVALID_RESPONSE` × 3 → assert `logger.error` called with stack
2. `CasesService.generate()` with `NETWORK_ERROR` → assert Spanish `BadGatewayException` + `errorType: "NETWORK_ERROR"`
3. `parseErrorResponse({ status: 500, body: "Internal Server Error" })` → assert Spanish fallback

Implement: backend logging → message localization → frontend parsing → UI. No new dependencies.

## Affected Areas

| File | Change |
|---|---|
| `apps/api/src/ai/document-generation.service.ts:99-110` | `logger.error` in catch |
| `apps/api/src/ai/open-router.service.ts:541-578` | Structured error logging |
| `apps/api/src/cases/cases.service.ts:282-289` | Spanish 502 + `errorType` |
| `apps/web/src/lib/api/cases.ts:68-95` | Plain-text 500 → Spanish |
| `apps/web/src/app/preview/[caseId]/page.tsx:43-92` | Retry button + error banner |
| `apps/api/src/ai/__tests__/document-generation.service.spec.ts` | New test |
| `apps/api/src/cases/__tests__/cases.service.spec.ts` | New test |
| `apps/web/src/lib/api/__tests__/cases.test.ts` (new) | `parseErrorResponse` test |

## Risks

| Risk | Mit |
|---|---|
| Surface previously-silent errors as log noise | Existing logger verbose; stdout only |
| Response body could include PII | Log ≤200 char fragment; never user form data |
| Spec drift in `new-case-flow` delta specs | Add R6/R7; do not edit R1–R5 |
| Localized 502 breaks existing consumers | Single consumer; component test covers |

## Rollback Plan

Revert 5 modified files + delete 1 new test file. No DB migrations, no infra. Single PR.

## Dependencies

None. Reuses existing `Logger` and `ApiError`.

## Success Criteria

- [ ] `INVALID_RESPONSE` × 3 → backend `error`-level log with stack
- [ ] `NETWORK_ERROR` → Spanish `BadGatewayException` + `errorType: "NETWORK_ERROR"`
- [ ] Plain-text `Internal Server Error` → Spanish fallback
- [ ] All existing tests pass
- [ ] Manual: forced AI failure on preview shows Spanish error with working in-page retry
- [ ] `pnpm typecheck` and `pnpm lint` pass
