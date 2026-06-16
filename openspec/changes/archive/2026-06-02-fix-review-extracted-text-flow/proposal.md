# Proposal: Fix Review Extracted Text Flow

## Intent

The analysis page currently renders a document preview with entity highlights and an entity list in a right column. These belong on the **review page**, not analysis. The review page renders a hardcoded template instead of real extracted text. Additionally, AI-generated `sourceSpan` offsets are imprecise because the LLM prompt says "posición aproximada" and no post-validation corrects them.

**Root causes**: (1) `extractedText` is never wired through `WizardState`/`WizardContext`/`wizardReducer`/`saveDraft`. (2) The AI prompt produces approximate spans with no backend correction.

## Scope

### In Scope
- Remove right column (preview + entity list) from `analysis/page.tsx` — keep stepper, confidence card, add CTA to review
- Add `extractedText` field to `WizardState`, wire through context, reducer, `saveDraft`, `SET_ANALYSIS_RESULT`
- Replace hardcoded template in `review/page.tsx` with real `state.extractedText` + `renderHighlightedText()`
- Post-validate AI `sourceSpan` offsets against actual `extractedText` in backend

### Out of Scope
- Changes to the AI model or prompt structure (only fix the "aproximada" wording + add post-validation)
- New Stitch screens (existing `p2-human-review-v2.html` already captures the target layout)
- Entity editing UI changes (already working via `EntityInspector`)

## Capabilities

### New Capabilities
None

### Modified Capabilities
- `client-wizard-flow`: WizardState gains `extractedText`; analysis page layout simplified to single-column; review page consumes real extracted text instead of hardcoded template
- `shared-contracts`: `AnalysisResult` schema gains optional `extractedText` field; `sourceSpan` post-validation contract added

## Approach

**Phase 1 — Data flow fix** (frontend, ~80 lines across 7 files):
1. Add `extractedText: string` to `WizardState` interface
2. Update `wizardReducer` `SET_ANALYSIS_RESULT` action to accept and store `extractedText`
3. Update `WizardContext.setWizardAnalysisResult()` signature to pass `extractedText`
4. Update `saveDraft()` to persist `extractedText`
5. Update `analysis/page.tsx` calls to pass `extractedText` from API response
6. Remove right column (lines 783–939) from analysis page, simplify to centered single-column with CTA
7. Replace hardcoded template in `review/page.tsx` (lines 126–206) with `renderHighlightedText(state.extractedText, state.entities)`

**Phase 2 — Highlight accuracy fix** (backend, ~35 lines):
1. In `open-router.service.ts`, change prompt from "posición aproximada" to "posición exacta"
2. Add post-validation: after AI returns entities, search `extractedText` for each `entity.value` and replace approximate `sourceSpan` with exact `indexOf` match positions
3. If no exact match found, set `sourceSpan` to `undefined` rather than keeping wrong offsets

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `apps/web/app/(wizard)/analysis/page.tsx` | Modified | Remove right column, pass extractedText |
| `apps/web/app/(wizard)/review/page.tsx` | Modified | Replace hardcoded template with real text |
| `apps/web/context/WizardContext.tsx` | Modified | Add extractedText to state + action signature |
| `apps/web/context/wizardReducer.ts` | Modified | Handle extractedText in SET_ANALYSIS_RESULT |
| `apps/web/lib/saveDraft.ts` | Modified | Persist extractedText |
| `packages/contracts/src/schemas.ts` | Modified | Add extractedText to AnalysisResult |
| `apps/api/src/ai/open-router.service.ts` | Modified | Fix prompt + add post-validation |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Entity value not found in extractedText (OCR drift, encoding) | Medium | Fall back to `undefined` sourceSpan; highlight gracefully degrades |
| Draft migration — existing drafts lack extractedText | Low | Default to empty string; old drafts still load |
| Layout shift on analysis page after removing right column | Low | Single-column centered layout is simpler; test on target viewport |

## Rollback Plan

Revert the 7 changed files. The `extractedText` field is additive to `WizardState` (optional with default `""`), so reverting is safe — no schema migration needed. Backend post-validation is a pure addition; removing it restores approximate spans (current behavior).

## Dependencies

- None — all changes are within existing codebase

## Success Criteria

- [ ] Analysis page shows only stepper + confidence card + CTA (no preview, no entity list)
- [ ] Review page renders real extracted text with entity highlights
- [ ] Entity highlights align to exact text positions (not approximate)
- [ ] Draft save/restore preserves extractedText across sessions
- [ ] Existing entity editing in review page continues working unchanged
