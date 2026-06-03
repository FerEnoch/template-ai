# Proposal: Fix Analysis Polling and Document Preview

## Intent

The document analysis pipeline has three critical bugs preventing reliable operation:

1. **Polling Flood**: Frontend polls the heavy, mutating `GET /api/analysis/:id` endpoint instead of the lightweight `GET /api/analysis/:id/status` endpoint, causing log spam, duplicate phase logs, and potential duplicate AI calls.

2. **Premature Timeout**: Frontend gives up after 16 seconds (`MAX_POLLING_ATTEMPTS = 20 × 800ms`), but OpenRouter AI calls take 10-30 seconds. Entities are successfully extracted but users see timeout errors.

3. **Missing Preview**: Document preview section renders only skeleton wireframes. No API endpoint exists to retrieve extracted text, and the `AnalysisResult` contract lacks an `extractedText` field.

## Scope

### In Scope
- Switch frontend polling from `GET /api/analysis/:id` to `GET /api/analysis/:id/status`
- Increase polling timeout to 48 seconds with elapsed-time fallback
- Fetch full result via `GET /api/analysis/:id` once after status completes
- Add `extractedText` field to `AnalysisResult` schema in `packages/contracts`
- Store extracted text in database during analysis Phase 2
- Include `extractedText` in `getFullResult` response
- Render extracted text in preview area with entity highlighting using `sourceSpan` data
- Clean up React StrictMode double-mount and `setInterval` leaks in `useEffect`

### Out of Scope
- Document metadata endpoint (`GET /documents/:id`)
- Enhanced loading states beyond current implementation
- Error recovery UI (retry button) after timeout
- WebSocket-based real-time updates (future optimization)

## Capabilities

### New Capabilities
- `document-preview`: Render extracted document text with entity highlighting in the analysis preview panel

### Modified Capabilities
- `shared-contracts`: Add `extractedText` field (string, nullable) to `AnalysisResult` schema

## Approach

### Fix 1: Polling Endpoint (P1)
- Change `apps/web/src/app/analysis/page.tsx` line 118 to call `/api/analysis/${documentId}/status`
- After status returns `completed`, fetch full result once via `/api/analysis/${documentId}`
- Reduces log noise and prevents duplicate AI pipeline triggers

### Fix 2: Timeout Extension (P2)
- Increase `MAX_POLLING_ATTEMPTS` from 20 to 60 (48 seconds max)
- Add elapsed-time-based fallback: if 45 seconds pass without completion, show "still analyzing" message instead of error
- Clean up `setInterval` in `useEffect` return to prevent memory leaks
- Add cleanup flag to prevent state updates after unmount (StrictMode safety)

### Fix 3: Document Preview (P3)
- **Backend**: Add `extractedText` column to `analysis_results` table (migration)
- **Backend**: Store extracted text in DB during Phase 2 of `document-analysis.service.ts`
- **Backend**: Update `getFullResult` to include `extractedText` in response
- **Contracts**: Add `extractedText: z.string().nullable()` to `AnalysisResult` schema
- **Frontend**: Replace skeleton wireframes (lines 400-450) with real text rendering
- **Frontend**: Highlight entities using `sourceSpan.start/end` with tooltip showing entity details

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `apps/web/src/app/analysis/page.tsx` | Modified | Polling logic, timeout handling, preview rendering |
| `packages/contracts/src/schemas.ts` | Modified | Add `extractedText` to `AnalysisResult` schema |
| `apps/api/src/analysis/analysis-results.repository.ts` | Modified | Store and retrieve `extractedText` field |
| `apps/api/src/analysis/document-analysis.service.ts` | Modified | Persist extracted text during Phase 2 |
| `apps/api/src/analysis/analysis.controller.ts` | No change | Already has `/status` endpoint; `getFullResult` auto-includes new field |
| Database: `analysis_results` table | Modified | Add `extracted_text` column (nullable TEXT) |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Existing analyses lack `extractedText` | High | Make field nullable; show "Preview unavailable" for old records |
| Polling change breaks status detection | Low | `/status` endpoint already exists and tested; add integration test |
| 48s timeout still insufficient for slow AI | Medium | Elapsed-time fallback shows "still analyzing" instead of error; user can refresh |
| Entity highlighting overlaps or misaligns | Low | Use `sourceSpan` character offsets; test with multi-paragraph documents |

## Rollback Plan

1. **Frontend polling**: Revert line 118 to `/api/analysis/${documentId}` (one-line change)
2. **Timeout**: Revert `MAX_POLLING_ATTEMPTS` to 20 (one-line change)
3. **Preview**: Hide preview section with feature flag; `extractedText` field remains nullable so no DB rollback needed
4. **Database**: Column is nullable and additive; no data loss on rollback

All changes are backward compatible. Rollback can be done per-fix without affecting others.

## Dependencies

- Fix 1 and Fix 2 are independent and can be implemented in parallel
- Fix 3 depends on Fix 1 (needs correct polling to fetch `extractedText` after completion)
- Database migration must run before backend code deployment (additive column, no lock)

## Success Criteria

- [ ] Polling uses `/api/analysis/:id/status` endpoint; logs show no duplicate phase entries
- [ ] Analysis completes successfully for documents taking 10-30 seconds (no timeout errors)
- [ ] Document preview renders extracted text with entity highlights for new analyses
- [ ] Old analyses (without `extractedText`) show graceful "Preview unavailable" message
- [ ] No memory leaks from `setInterval` or state updates after unmount
- [ ] Integration test covers polling → completion → preview rendering flow
