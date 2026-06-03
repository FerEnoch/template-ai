# Tasks: Fix Review Extracted Text Flow

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~165 (115 src + ~50 test) |
| 400-line budget risk | Low |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (frontend) → PR 2 (backend) |
| Delivery strategy | force-chained |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Frontend data flow + UI rewrite | PR 1 | base=main; 9 files + 1 new util + tests |
| 2 | Backend sourceSpan post-validation | PR 2 | base=main; 1 service + 1 prompt + tests |

## Phase 1: Frontend Data Flow (PR 1, stacked-to-main)

### Contracts & schema
- [x] 1.1 RED: test `WizardDraftSchema` parses `extractedText` when present and tolerates legacy drafts omitting it
- [x] 1.2 GREEN: add `extractedText: z.string().optional()` to `WizardDraftSchema` in `packages/contracts/src/schemas.ts`

### Wizard state machine
- [x] 1.3 RED: extend `wizardReducer.test.ts` — `SET_ANALYSIS_RESULT` stores `extractedText`; `clearDownstreamState` to `UPLOAD` resets to `null`; `SET_DRAFT`/`LOAD_DRAFT` carry it
- [x] 1.4 GREEN: add `extractedText: string | null` to `WizardState` + `SET_ANALYSIS_RESULT` payload in `types.ts`; init in `initialWizardState`; handle in reducer; extend `clearDownstreamState` UPLOAD branch

### Storage refactor
- [x] 1.5 RED: rewrite `storage.test.ts` cases for new `SaveDraftInput` (round-trip with `extractedText`, legacy draft, minimal call)
- [x] 1.6 GREEN: refactor `saveDraft` in `storage.ts` to `saveDraft(input: SaveDraftInput)` incl. `extractedText?: string | null`

### Shared highlighter
- [x] 1.7 RED: write `highlightText.test.tsx` — renders marks for entities with `sourceSpan`, skips `undefined` spans, plain span for empty entities
- [x] 1.8 GREEN: create `highlightText.tsx` (move from analysis L480-521); export from `lib/wizard/index.ts`

### Context + call sites
- [x] 1.9 GREEN: change `setAnalysisResult(id, entities, extractedText)` in `WizardContext.tsx`
- [x] 1.10 GREEN: update 3 call sites — `upload/page.tsx` L28 → `saveDraft({ file })`; `analysis/page.tsx` L322 + L394 pass `extractedText`

### Page rewrites
- [x] 1.11 GREEN: in `analysis/page.tsx` remove right column (L782-940) for single-column CTA; drop local `renderHighlightedText` (L480-521); import from `@/lib/wizard`
- [x] 1.12 GREEN: in `review/page.tsx` replace hardcoded `<article>` (L125-206) with `renderHighlightedText(state.extractedText, state.entities)`; null/empty → fallback

## Phase 2: Backend Highlight Accuracy (PR 2, stacked-to-main)

### sourceSpan post-validation
- [x] 2.1 RED: extend `document-analysis.service.spec.ts` — exact match replaces AI span; multi-match picks closest to `aiSpan.start`; no match sets `sourceSpan: undefined`; case-sensitive miss
- [x] 2.2 GREEN: add private `validateAndCorrectSpans(entities, extractedText)` in `apps/api/src/ai/document-analysis.service.ts` (case-sensitive `indexOf`, closest-match)
- [x] 2.3 GREEN: invoke `validateAndCorrectSpans(aiResult.entities, fileContent)` inside `analyze()` before returning
- [x] 2.4 OPTIONAL: change "posición aproximada" → "posición exacta" in `open-router.service.ts` L58 (prompt wording only)

## Phase 3: Verification

- [ ] 3.1 `pnpm --filter @template-ai/web test` and `pnpm --filter @template-ai/api test` — all green
- [ ] 3.2 `pnpm typecheck` at repo root — zero errors
- [ ] 3.3 Manual: complete analysis → review shows real text with aligned highlights; analysis page CTA-only; legacy draft loads
