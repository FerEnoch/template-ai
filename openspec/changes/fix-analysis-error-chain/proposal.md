# Proposal: Fix Analysis Error Chain

## Intent

The document analysis pipeline has 6 interconnected bugs forming a **failure chain**: when AI response JSON is truncated (root cause: `maxTokens: 4096` too low), an unhandled `JSON.parse` SyntaxError is misclassified as `NETWORK_ERROR`, never retried, and the frontend freezes at 75% because it never updates state on `failed` status. The prior change (`fix-analysis-polling-and-preview`) specified fixes for the polling endpoint and preview but its verify report shows 5 incomplete tasks — the implementation was never applied.

## Scope

### In Scope
- **B1**: Wrap `JSON.parse` in try/catch at `open-router.service.ts:193`
- **B2**: Classify `SyntaxError` as `INVALID_RESPONSE` (not `NETWORK_ERROR`) at `open-router.service.ts:244-254`
- **B3**: Expand retry logic to cover `NETWORK_ERROR` and `INVALID_RESPONSE` at `document-analysis.service.ts:133-135`
- **B4**: Increase `maxTokens` from 4096 to 8192+ at `config/ai.ts:10`
- **B5**: Call `setAnalysisResult(result)` on `failed` status at `page.tsx:148-151`
- **B6**: Switch polling to `GET /:id/status` at `page.tsx:131`
- **Race condition**: Guard `setInterval` callbacks against stale state re-entry

### Out of Scope
- WebSocket-based real-time updates
- Retry button UI (future enhancement)
- Token counting / dynamic budget allocation
- Changes to AI model selection or prompt engineering

## Capabilities

### New Capabilities
- `ai-error-resilience`: JSON parse safety, error classification, expanded retry policy, and token budget management for the AI extraction pipeline

### Modified Capabilities
- `document-preview`: Implementation fix — polling must use `/status` endpoint and handle `failed` status correctly (spec already requires this; code does not comply)

## Approach

| Bug | Fix | Key Detail |
|-----|-----|------------|
| B4 (root cause) | Raise `maxTokens` to 8192 | Separates prompt budget from response budget |
| B1 | `try/catch` around `JSON.parse` | Throw `OpenRouterError("INVALID_RESPONSE")` on SyntaxError |
| B2 | Add `SyntaxError` check before generic catch | Map to `INVALID_RESPONSE` instead of `NETWORK_ERROR` |
| B3 | Retry on `NETWORK_ERROR` + `INVALID_RESPONSE` | Honor ai-integration spec: up to 3 retries |
| B5 | `setAnalysisResult(result)` on failed | Clears `isProcessing`, unblocks UI |
| B6 | Poll `/:id/status` instead of `/:id` | Matches document-preview spec requirement |
| Race | `isStale` ref guard | Prevents stale interval callbacks from resetting state |

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `apps/api/src/config/ai.ts:10` | Modified | `maxTokens: 4096` → `8192` |
| `apps/api/src/ai/open-router.service.ts:193,221-254` | Modified | JSON.parse safety + error classification |
| `apps/api/src/ai/document-analysis.service.ts:130-141` | Modified | Expand retry to 3 error types |
| `apps/web/src/app/analysis/page.tsx:131,148-151` | Modified | Poll /status + handle failed state |
| `packages/contracts/src/schemas.ts` | No change | Schema already correct |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| 8192 tokens still insufficient for large docs | Low | Monitor; future: dynamic token budget |
| Retry on INVALID_RESPONSE loops on consistently bad AI | Low | Max 3 retries per ai-integration spec; permanent failure after |
| Frontend state fix exposes other stale-state bugs | Medium | `isStale` ref guard covers all interval callbacks |
| `fix-analysis-polling-and-preview` spec diverges from reality | High | This change implements what that spec requires |

## Rollback Plan

1. **Backend**: Revert `maxTokens` to 4096, remove JSON.parse try/catch, narrow retry to RATE_LIMIT only — all in 3 files, ~20 lines
2. **Frontend**: Revert polling URL and failed-status handler — 2 lines in `page.tsx`
3. All changes are backward compatible; no DB migrations involved

## Dependencies

- B4 (maxTokens) should be fixed first — it's the root cause that triggers B1→B2→B3→B5
- B6 (polling endpoint) is independent and can be done in parallel with backend fixes

## Success Criteria

- [ ] Upload a 3-5 page PDF → analysis completes with entities (no freeze at 75%)
- [ ] Truncated AI JSON → retry up to 3 times, then `failed` status (not crash)
- [ ] Frontend shows error message on `failed` (not frozen "En proceso...")
- [ ] Polling uses `/status` endpoint — no duplicate Phase 1 logs in server output
- [ ] No `SyntaxError` unhandled exceptions in API logs
- [ ] Race condition: rapid polling responses don't re-enable `isProcessing`
