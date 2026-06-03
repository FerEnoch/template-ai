# Tasks: Fix Analysis Polling and Document Preview

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~136 (backend/API) + ~80 (frontend) + tests |
| 400-line budget risk | Medium |
| Chained PRs recommended | No |
| Suggested split | Single PR (no PRs for now — delivery_strategy: ask-always) |
| Delivery strategy | ask-always |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Medium

## Phase 1: Database Migration

- [x] 1.1 Create `apps/api/src/infrastructure/postgres/migrations/0006_extracted_text.sql` with `ALTER TABLE analysis_results ADD COLUMN IF NOT EXISTS extracted_text TEXT;`

## Phase 2: Repository Layer

- [x] 2.1 Add `extractedText: string | null` to `AnalysisResultRecord` interface in `analysis-results.repository.ts`
- [x] 2.2 Add `extractedText: (row["extracted_text"] as string | null) ?? null` to `rowToAnalysisResult` mapping
- [x] 2.3 Add `extracted_text` to SELECT column lists in: `findById`, `findByDocumentId`, `incrementProgress`, `atomicTransitionToAnalyzing`, `updateStatus`, `incrementRetryCount`, `create`
- [x] 2.4 Add `extracted_text` to RETURNING clauses in all queries that return analysis results
- [x] 2.5 Add `saveExtractedText(id: string, extractedText: string): Promise<void>` method to `AnalysisResultsRepository`
- [ ] 2.6 Write unit tests for `saveExtractedText` in `analysis-results.repository.spec.ts`

## Phase 3: Contract Schema

- [x] 3.1 Add `extractedText: z.string().nullable()` to `AnalysisResultSchema` in `packages/contracts/src/schemas.ts`
- [ ] 3.2 Write/update contract validation tests for `AnalysisResultSchema` accepting both `extractedText` string and null

## Phase 4: Backend Service Changes

- [x] 4.1 Add `extractedText?: string` to `AnalyzeResult` interface in `document-analysis.service.ts`
- [x] 4.2 Update `analyze()` to return `extractedText: fileContent` in the success response (after AI call, pass through the extracted text)
- [ ] 4.3 Write unit tests for `AnalyzeResult` including `extractedText` in `document-analysis.service.spec.ts`
- [x] 4.4 Add `extractedText: string | null` to `AnalysisResult` interface in `analysis.service.ts`
- [x] 4.5 In Phase 3 success path of `getFullResult()`, call `analysisRepo.saveExtractedText(phase1Result.analysisResultId, aiResult.extractedText)` when `aiResult.extractedText` is present
- [x] 4.6 Update `mapToAnalysisResult()` to include `extractedText: record.extractedText`
- [ ] 4.7 Write unit tests for `getFullResult` including `extractedText` in `analysis.service.spec.ts`

## Phase 5: Frontend Polling Refactor

- [x] 5.1 Change `MAX_POLLING_ATTEMPTS` from 20 to 60 in `apps/web/src/app/analysis/page.tsx`
- [x] 5.2 Add `MAX_POLLING_TIME_MS = 55_000` constant for elapsed-time fallback
- [x] 5.3 Change polling endpoint from `/api/analysis/${documentId}` to `/api/analysis/${documentId}/status`
- [x] 5.4 Update polling response parsing to use `AnalysisStatus` type (status + progress fields only)
- [x] 5.5 On status `completed`: fetch full result once via `/api/analysis/${documentId}`, then set result
- [x] 5.6 Add elapsed-time check: if `elapsed > MAX_POLLING_TIME_MS`, show "still analyzing" message
- [x] 5.7 Add `clearInterval` in useEffect cleanup and mount-guard flag for StrictMode safety
- [ ] 5.8 Write integration test for polling flow: poll `/status` → completed → fetch full result

## Phase 6: Frontend Preview Rendering

- [x] 6.1 Implement `renderHighlightedText(text: string, entities: Entity[]): React.ReactNode` using `sourceSpan.start/end` offsets with confidence-based color classes
- [x] 6.2 Replace skeleton wireframes with conditional rendering: if `extractedText` present → render highlighted text; if null → show "Vista previa no disponible" placeholder
- [x] 6.3 Ensure file metadata (name, size) renders in both preview and placeholder states

## Phase 7: Verification

- [ ] 7.1 Run `pnpm --filter @template-ai/api test` — all tests pass
- [ ] 7.2 Manual: Upload PDF, verify `/status` polling (no duplicate Phase 1 logs in backend)
- [ ] 7.3 Manual: Wait for completion, verify no timeout error (20-30s analysis)
- [ ] 7.4 Manual: Verify preview shows highlighted extracted text with entity tooltips
- [ ] 7.5 Manual: Verify old document (pre-migration, NULL extractedText) shows "Vista previa no disponible"
