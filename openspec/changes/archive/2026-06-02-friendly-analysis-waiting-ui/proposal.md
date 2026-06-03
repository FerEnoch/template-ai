# Proposal: Friendly Analysis Waiting UI

## Intent

The AI analysis phase takes 20-30 seconds but the frontend provides zero differentiated feedback — the progress bar stalls at 100%, the stepper freezes at step 2, and skeleton loaders communicate nothing. Users experience anxiety, not patience. The API already returns `status: "analyzing"` during the AI phase, but the frontend treats it identically to `"processing"`. This change surfaces that distinction as a friendly, informative waiting experience.

## Scope

### In Scope
- Differentiate `status: "analyzing"` as a distinct visual state in the analysis page
- Indeterminate progress bar during AI phase (replaces stuck-at-100%)
- Rotating status messages explaining what the AI is doing (5-6s intervals with fade transitions)
- Unfreeze the in-page stepper: steps 2-4 show "En proceso" during AI phase
- Elapsed time counter during analysis
- Prominent file info badge (filename + size) during processing
- `aria-live` region for screen reader progress announcements
- Stitch screens for the waiting/loading analysis states (design reference)
- Unit tests for new components (Strict TDD)
- Update `shared-contracts` spec to include `"analyzing"` in status enum (already in code, missing from spec)

### Out of Scope
- Backend sub-phase reporting (`text_extracting`, `ai_calling`, `ai_parsing`) — future iteration
- SSE/streaming progress — overkill for 20-30s wait
- Rewriting the polling mechanism — keep existing 800ms interval
- Cancel confirmation dialog — separate UX concern
- Changes to the top-level `StepIndicator` (wizard steps, not analysis sub-phases)

## Capabilities

### New Capabilities
- `analysis-waiting-ui`: Dedicated waiting UI for the AI analysis phase — indeterminate progress, rotating status messages, elapsed timer, file info badge, accessible announcements

### Modified Capabilities
- `client-wizard-flow`: Analysis step must differentiate `"analyzing"` from `"processing"` status for stepper progression and skeleton replacement behavior
- `shared-contracts`: Spec must add `"analyzing"` to the `AnalysisResult.status` enum (already present in `packages/contracts/src/schemas.ts` line 13, spec is out of sync)

## Approach

**Frontend-only differentiation** (Approach 1 from exploration). The API already provides the key signal (`status: "analyzing"`). We add an `isAnalyzing` derived state and branch the UI:

1. Extract reusable `AnalysisProgress` component from the inline logic in `page.tsx`
2. When `status === "analyzing"`: swap determinate progress bar → indeterminate stripe animation, activate rotating messages, start elapsed timer, update stepper steps 2-4
3. When `status === "processing"`: keep current behavior (fast, < 2s)
4. Generate Stitch screens for design alignment before implementation
5. Implementation by expert frontend agents with `frontend-developer` + `sdd-apply` skills

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `apps/web/src/app/analysis/page.tsx` | Modified | Add `isAnalyzing` state, extract AnalysisProgress component, update stepper logic |
| `apps/web/src/components/analysis/AnalysisProgress.tsx` | New | Reusable waiting UI: indeterminate bar, rotating messages, timer, file badge |
| `apps/web/src/app/globals.css` | Modified | Add `@keyframes` for indeterminate stripe animation |
| `packages/contracts/src/schemas.ts` | Unchanged | Already has `"analyzing"` — no code change needed |
| Stitch project `13244395666194572658` | New screens | 2-3 screens for analysis waiting states |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Indeterminate animation spins forever on silent AI failure | Low | Existing timeout (55s) and max-poll (60 attempts) guards remain active |
| Rotating messages don't match real AI timing | Medium | Cosmetic-only; messages are "best effort" descriptions, not data-driven |
| Extracted component breaks existing inline logic | Low | TDD: write tests first, refactor incrementally |

## Rollback Plan

Revert the `AnalysisProgress` component extraction and restore inline logic in `page.tsx`. The `isAnalyzing` branch is purely additive — removing it restores the original `isProcessing` behavior. No database or API changes to rollback. Stitch screens are non-blocking references.

## Dependencies

- Stitch project access for screen generation (project ID: `13244395666194572658`)
- Existing design tokens in `globals.css` (Literata, Source Serif 4, Inter, accent `#3d6b8f`)

## Success Criteria

- [ ] User sees distinct visual state when AI analysis begins (not same as processing)
- [ ] Progress bar shows indeterminate animation during `analyzing` (never stuck at 100%)
- [ ] Stepper steps 2-4 all show "En proceso" during AI phase
- [ ] At least 3 rotating status messages visible during a 20s wait
- [ ] Elapsed time counter visible and updating every second
- [ ] Filename displayed prominently during analysis
- [ ] `aria-live` region announces phase change for screen readers
- [ ] All new components have unit tests (Vitest)
- [ ] Stitch screens generated for waiting states
