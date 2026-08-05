# Proposal: Fix Generation Delay UI Message

## Intent

On `/nuevo/[id]`, clicking "Generar documento" succeeds on the backend (~48s OpenRouter call, logs confirm) but the UI shows "Ocurrió un error inesperado." Root cause: the Next.js dev rewrite proxy closes the connection after ~30s and returns an HTML 502 page; `fallbackMessageForStatus` has no 500/502 case, and `parseErrorResponse` cannot parse HTML, so it falls to the generic default. The user is misled into thinking generation failed when it actually completed.

## Scope

### In Scope — Phase 1 (immediate)
- `experimental.proxyTimeout: 300_000` in `apps/web/next.config.ts`
- Add 502 + 500 to `fallbackMessageForStatus` with latency-aware Spanish copy
- `parseErrorResponse` handles non-JSON / HTML error bodies
- `REQUEST_TIMEOUT_MS` → 300s in `apps/api/src/main.ts` (covers 3 retries × 48s worst case)
- Spinner + "Generando documento... Esto puede tomar hasta 2 minutos." UX
- Harden `handleGenerate()` catch so a proxy failure after backend success is detected via `fetchCase()` re-check
- Friendly error message only — NO retry button in Phase 1

### In Scope — Phase 2 (follow-up, planned here; implemented separately)
- `POST /cases/:id/generate` returns `202 Accepted` immediately
- AI generation moves to a background job (BullMQ candidate)
- Frontend polls `GET /cases/:id` for status changes
- Status lifecycle: `borrador` → `generating` → `generado`; user may navigate away and return

### Out of Scope
- Retry button on Phase 1 error UI (deferred)
- WebSocket / SSE push (Phase 2 uses polling)
- AI model, prompt, token, or cost changes
- DB schema changes in Phase 1

## Capabilities

### New Capabilities
- `document-generation-ux`: Latency-aware generation waiting UI + frontend error mapping (502/500 fallbacks, HTML-body tolerance, catch-recovery that re-checks case status). **Phase 1.**
- `async-document-generation`: Background generation lifecycle — `202 Accepted`, queue worker, status polling, `borrador → generating → generado` transitions, navigate-away resilience. **Phase 2.**

### Modified Capabilities
- `document-generation`: backend `requestTimeout` must accommodate worst-case retry budget (~150s) with a Spanish 502/500 error contract.
- `local-operational-infra`: the existing "reduced request timeout (30s)" requirement conflicts with the Phase-1 300s band-aid; document the synchronous-generation exception and revert in Phase 2.

## Approach

**Phase 1** — config + defensive parsing, no new infra. (1) `proxyTimeout` keeps the Next proxy alive for the long call. (2) Latency-aware fallbacks distinguish "proxy dropped mid-generation" (502) from "backend error" (500). (3) `handleGenerate` catch re-fetches the case — if status is `generado`, treat as success instead of surfacing the proxy error. (4) Spinner copy sets a 2-minute expectation.

**Phase 2** — async contract. Decouple the HTTP request from AI work via a queue; the endpoint returns 202 and the client polls. Eliminates the proxy-timeout class entirely and restores short server timeouts.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `apps/web/next.config.ts` | Modified | Add `experimental.proxyTimeout` |
| `apps/web/src/lib/api/cases.ts` | Modified | 502/500 fallbacks, HTML-tolerant parse |
| `apps/web/src/app/nuevo/[templateId]/page.tsx` | Modified | Spinner copy, catch recovery |
| `apps/web/src/components/case/CaseStickyBar.tsx` | Modified | Latency-context error UI |
| `apps/api/src/main.ts` | Modified | `REQUEST_TIMEOUT_MS` → 300s |
| `apps/api/src/ai/document-generation.service.ts` | Reviewed | Retry budget vs timeout |
| `openspec/specs/local-operational-infra` | Modified (Phase 1) | requestTimeout exception |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| 300s `requestTimeout` conflicts with `local-operational-infra` 30s spec | High | Document exception; Phase 2 reverts to short timeout |
| Proxy timeout fix only masks slow AI in prod (no dev proxy there) | Med | Latency-aware messaging independent of proxy |
| Catch recovery hides real backend failures | Med | Only treat as success when `fetchCase` confirms `generado` |
| Phase 2 queue adds infra complexity | Med | Phase 2 is a separate change with its own design |

## Rollback Plan

Phase 1 reverts cleanly — revert `next.config.ts`, `main.ts`, `cases.ts`, `page.tsx`, `CaseStickyBar.tsx`. No DB migrations, no new dependencies. Phase 2 is additive behind the 202 contract; revert returns to synchronous Phase 1 behavior.

## Dependencies

- `withOwnerTransaction` + RLS context (existing) for status re-check
- OpenAI SDK default 600s timeout already covers the backend call

## Success Criteria

- [ ] Manual: `/nuevo/[id]` → Generar → spinner shows 2-minute message; document appears after ~48s
- [ ] Forced proxy 502 → friendly latency-aware Spanish message, not "error inesperado"
- [ ] Proxy drops after backend success → `handleGenerate` catch recovers as success
- [ ] `pnpm typecheck` + `pnpm lint` + `pnpm test` (api + web) pass
- [ ] Phase 2 spec written and reviewed (separate change)