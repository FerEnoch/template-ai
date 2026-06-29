# Design: Regenerate Document Error Fix

## Technical Approach

Five fixes along the `POST /api/cases/:id/generate` path, applied TDD-first (failing tests → backend logging → Spanish 502 + `errorType` → frontend plain-text fallback → in-page retry UI). No new dependencies: reuse NestJS `Logger`, the existing `OpenRouterError`, and the existing `ApiError`. No DB or contract changes — `errorType` rides inside error response bodies and the frontend `ApiError`.

## Architecture Decisions

| Decision | Option | Tradeoff | Chosen |
|---|---|---|---|
| D1: Where to log the full stack | `CasesService.generate()` catch | Already logs `error.message` only; stack lost for `BadGateway` path | **`DocumentGenerationService.generate()` catch** — single point where `OpenRouterError` originates with full stack |
| D2: `errorType` transport to frontend | New contracts schema field | Adds shared-package change + consumer updates | **Inline in JSON body** via `BadGatewayException({ message, errorType })`; NestJS filters merge object into `{ statusCode, message, errorType, error }` |
| D3: Surface `errorType` in UI | Pass through `ApiError` | Adds `ApiError.errorType` field | **Extend `ApiError` with optional `errorType`**; populated in `parseErrorResponse` when present |
| D4: Plain-text 500 handling | Strip the raw-text branch entirely | Breaks 4xx short-text messages | **Gate raw-text return to `status < 500`**; 5xx plain-text always uses `fallbackMessageForStatus` |
| D5: Retry button | Keep current `window.location.reload()` | Loses user edits, full reload | **Call `handleRegenerate()`**; separate `regenError` state so retry stays enabled below a Spanish banner |
| D6: Test file location for logging test | New `apps/api/src/ai/__tests__/` (proposal) | Diverges from repo convention | **Extend existing `apps/api/src/cases/__tests__/document-generation.service.spec.ts`** — actual codebase co-locates it. Proposal path is advisory. |

## Data Flow

```
OpenRouter SDK ──throw──▶ OpenRouterService.generateDocument()
                              │ logger.error(status, body≤200ch)   ◀── R7
                              ▼ OpenRouterError
DocumentGenerationService.generate() catch ── logger.error(stack) ◀── R7
                              ▼ { success:false, error, errorType }
CasesService.generate() ─ BadGatewayException({ message:es, errorType })
                              ▼ JSON { statusCode:502, message:es, errorType }
fetch() ─▶ parseErrorResponse() ─ ApiError(esMessage, 502, errorType?) ◀── R6 + plain-text 500 fix
                              ▼
Preview page.setRegenError() ─ Spanish banner + enabled "Reintentar" ─▶ handleRegenerate()
```

## File Changes

| File | Action | Description |
|---|---|---|
| `apps/api/src/ai/document-generation.service.ts` | Modify | Add `this.logger.error(message, error.stack)` in `generate()` catch (R7). |
| `apps/api/src/ai/open-router.service.ts` | Modify | Before each `throw new OpenRouterError(...)` for HTTP-status branches (401/404/429/>0/0): `this.logger.error(...)` with status + body fragment ≤200 chars, never `userPrompt`. |
| `apps/api/src/cases/cases.service.ts` | Modify | `BadGatewayException({ message: "No se pudo contactar al servicio de IA. Intentá nuevamente.", errorType: genResult.errorType ?? "UNKNOWN" })` (R5). |
| `apps/web/src/lib/api/cases.ts` | Modify | Export `parseErrorResponse` for testing; gate raw-text return to `status < 500` (plain-text 500 → fallback); extract `errorType` from parsed body; add optional `errorType` to `ApiError`. |
| `apps/web/src/app/preview/[caseId]/page.tsx` | Modify | Add `regenError` state + Spanish banner; "Reintentar" calls `handleRegenerate` (never `reload`). Two error states: page-load error (existing) vs regenerate error (new, keeps preview visible). |
| `apps/api/src/cases/__tests__/document-generation.service.spec.ts` | Modify | New `describe("error logging")`: mock `INVALID_RESPONSE` ×3, spy on `Logger.prototype.error`, assert called with stack. |
| `apps/api/src/cases/__tests__/cases.service.spec.ts` | Modify | New test: `generate` returns Spanish `BadGatewayException` carrying `errorType: "NETWORK_ERROR"` when `generate()` fails with `NETWORK_ERROR`. |
| `apps/web/src/lib/api/__tests__/cases.test.ts` | Create | `parseErrorResponse`: plain `"Internal Server Error"` @500 → Spanish fallback; JSON body with `errorType` → `ApiError.errorType` set; 4xx short text still returned. |

## Interfaces / Contracts

```ts
// apps/web/src/lib/api/cases.ts
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly errorType?: string,
  ) { super(message); this.name = "ApiError"; }
}
export async function parseErrorResponse(res: Response): Promise<string>; // exported for tests
```

Backend: `BadGatewayException` body shape is decided by existing NestJS filter, not a contract change.

## Testing Strategy

| Layer | What | Approach |
|---|---|---|
| Unit (api) | `DocumentGenerationService` logs stack on `INVALID_RESPONSE` ×3 | Spy on `Logger.prototype.error`; fake timers (existing pattern in spec) |
| Unit (api) | `CasesService.generate` Spanish BadGateway + errorType | Mock `generate()` to return `{ success:false, errorType:"NETWORK_ERROR" }`; assert `BadGatewayException.getResponse()` |
| Unit (web) | `parseErrorResponse` plain-text 500, JSON errorType | Construct `new Response(body, { status })`; function exported from `cases.ts` |
| Component | Preview retry after failure | RTL render, mock `generateCase` reject → click "Reintentar" → assert second `generateCase` call |

## Migration / Rollout

No migration. Single PR. Rollback = revert 4 modified files + 1 new test dir, delete 1 test file.

## Open Questions

- [ ] D6: confirm repo accepts extending the co-located spec vs. creating `ai/__tests__/`. Default: extend existing.
- [ ] Should `errorType` be shown verbatim to end users ("NETWORK_ERROR") or hidden behind a debug toggle? Spec R6 says "visible for debugging" — default: render small monospace label.