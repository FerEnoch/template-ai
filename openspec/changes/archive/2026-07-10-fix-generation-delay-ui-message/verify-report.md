# Verify Report: fix-generation-delay-ui-message

**Date**: 2026-07-10
**Commits verified**:
- `38df2f8` fix: raise request and proxy timeouts to 300s for AI document generation
- `f473c3f` fix(web): add latency-aware 502/500 messages and generation time expectation

## Status: PASS

All 7 requirements verified. All automated checks green.

## Automated Checks

| Check | Result | Details |
|-------|--------|---------|
| `pnpm typecheck` | PASS | 3/3 workspace projects clean |
| `pnpm lint` | PASS | 3/3 workspace projects clean |
| `pnpm --filter @template-ai/web test` | PASS | 232 tests passed, 30 test files |
| `pnpm --filter @template-ai/api test` | PASS | 378 tests passed (2 skipped), 34 test files |

## Requirement Verification

### R1: Generation spinner with time expectation — PASS
- **File**: `apps/web/src/components/case/CaseStickyBar.tsx` line 37
- **Evidence**: Exact text `"Generando documento... Esto puede tomar hasta 2 minutos."` rendered when `status === "generating"` with `Loader2` spin animation.

### R2: Latency-aware 502 fallback message — PASS
- **File**: `apps/web/src/lib/api/cases.ts` line 55
- **Evidence**: `fallbackMessageForStatus(502)` returns `"El servidor está procesando tu solicitud. Esto puede tardar hasta 2 minutos. Esperá un momento e intentá nuevamente."` — latency-aware, not the generic "error inesperado".
- **Test**: `cases.test.ts` line 9-13 asserts exact match.

### R3: Internal error 500 fallback message — PASS
- **File**: `apps/web/src/lib/api/cases.ts` line 53
- **Evidence**: `fallbackMessageForStatus(500)` returns `"Hubo un problema interno en el servidor. Si el problema persiste, contactá a soporte."` — acknowledges server error with actionable guidance.
- **Test**: `cases.test.ts` line 15-19 asserts exact match.

### R4: HTML/plain-text tolerant error parsing — PASS
- **File**: `apps/web/src/lib/api/cases.ts` lines 79-113
- **Evidence**: `parseErrorResponse` reads body as text, attempts JSON.parse, catches parse failure. For status >= 500 with non-JSON body, falls back to `fallbackMessageForStatus` without throwing.
- **Tests**: HTML 502 body test (line 49-60), 500 plain-text test (line 23-31), 502 JSON without error field test (line 33-47).

### R5: Catch recovery via case status re-check — PASS
- **File**: `apps/web/src/app/nuevo/[templateId]/page.tsx` lines 108-142
- **Evidence**: `handleGenerate` catch block calls `fetchCase(state.caseId)`, redirects to `/preview/[id]` on `generado`, `/biblioteca` on `archivado`, else surfaces error via `setGenerationError`. Already implemented, verified by apply phase.

### R6: Backend requestTimeout 300s — PASS
- **File**: `apps/api/src/main.ts` line 45
- **Evidence**: `const REQUEST_TIMEOUT_MS = 300 * 1000;` applied at line 85 via `server.requestTimeout = REQUEST_TIMEOUT_MS;`. `server.timeout` remains `0` (line 46/86). `TODO(Phase2)` comments present at lines 18-19 and 44, naming `async-document-generation`.

### R7: Next.js proxyTimeout 300_000ms — PASS
- **File**: `apps/web/next.config.ts` line 6
- **Evidence**: `experimental: { proxyTimeout: 300_000 }` with Phase 1 comment on line 5.

## Spec Delta Check: local-operational-infra — PASS
- Phase 1 exception documented (lines 9-11): `requestTimeout` temporarily 300s for sync `/generate` endpoint.
- `TODO(Phase2)` comment naming `async-document-generation` change present in `main.ts`.
- Phase 2 reversion scenario documented (lines 35-40).

## Findings

### SUGGESTION

1. **500 message copy differs from design.md** — Design suggested `"Ocurrió un error interno en el servidor. Intentá nuevamente en unos momentos."` but implementation uses `"Hubo un problema interno en el servidor. Si el problema persiste, contactá a soporte."` The implementation's version is arguably better (offers a concrete next step: contact support). Not a spec violation — spec says "message acknowledging server processing load" without mandating exact wording.

2. **502 message copy differs from design.md** — Design suggested `"Aguardá y volvé a intentarlo"` but implementation uses `"Esperá un momento e intentá nuevamente"`. Both are latency-aware Spanish messages. Not a spec violation.

### No CRITICAL or WARNING findings.

## Conclusion

All Phase 1 requirements are met. The implementation is clean, well-tested, and ready for merge. Copy variations from design.md are within spec tolerance and in one case (500 message) represent an improvement.
