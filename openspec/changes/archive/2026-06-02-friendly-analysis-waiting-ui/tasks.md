# Tasks: Friendly Analysis Waiting UI

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~450-550 (component ~220 + tests ~180 + CSS ~25 + page.tsx delta ~80 + spec sync ~5) |
| 400-line budget risk | Medium |
| Chained PRs recommended | Yes (user-forced) |
| Delivery strategy | force-chained |
| Chain strategy | stacked-to-main |
| Suggested split | PR #1: design + component + tests + CSS → PR #2: page.tsx integration + verification |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: Medium

### Suggested Work Units (Stacked)

| Unit | Goal | Likely PR | Base branch | Notes |
|------|------|-----------|-------------|-------|
| 1 | Design reference + reusable component isolated | PR #1 | `main` | Stitch screens, `AnalysisProgress.tsx`, `AnalysisProgress.test.tsx`, CSS keyframes, `shared-contracts` spec sync. Self-contained, verifiable with `vitest` and visual review of Stitch screens. |
| 2 | Wire component into `page.tsx` and prove end-to-end | PR #2 | `main` (stacked on top of PR #1) | Timer/message state, replace inline skeleton, run typecheck + Vitest + Playwright smoke. ~80 net lines. |

## Phase 1: Stitch Screens (Design Reference) → PR #1

- [ ] 1.1 Generate Stitch screen "Analysis Waiting — 5s elapsed" in project `13244395666194572658` using the prompt in `design.md` §"Stitch Screens" #1 (5 messages pool, 1 visible: "Leyendo el documento…", timer 00:05, file badge "contrato-alquiler.pdf · 2.4 MB", tokens: Literata, Source Serif 4, accent `#3d6b8f`, surface `#fdfcf9`, bg `#f5f1e8`).
- [ ] 1.2 Generate Stitch screen "Analysis Waiting — 25s elapsed" using prompt #2 from `design.md` (message "Extrayendo entidades…", timer 00:25, reassurance note visible).
- [ ] 1.3 Generate Stitch screen "Analysis Waiting — Full page view" using prompt #3 from `design.md` (both columns, pulsing document icon, both skeleton panels).
- [ ] 1.4 Verify the three screens render with the correct design tokens and capture the screen IDs for the PR description.

## Phase 2: TDD — Write Tests First (RED) → PR #1

- [ ] 2.1 Create `apps/web/src/components/analysis/AnalysisProgress.test.tsx` with the 10 unit tests from `design.md` §"Testing Strategy" using Vitest + Testing Library (no implementation yet).
- [ ] 2.2 Run `pnpm --filter web test AnalysisProgress` and confirm all 10 tests fail for the expected reasons (missing component, no exports, no props). Capture baseline output.

## Phase 3: Implement `AnalysisProgress` (GREEN → REFACTOR) → PR #1

- [ ] 3.1 Create `apps/web/src/components/analysis/AnalysisProgress.tsx` with the `AnalysisProgressProps` interface from `design.md` §"Component Design". Start with the simplest "completed" variant.
- [ ] 3.2 Add "processing" variant: determinate progress bar with `aria-valuenow={progress}`; no rotating messages; no timer; file badge always shown.
- [ ] 3.3 Add "analyzing" variant: indeterminate scan-line bar (`aria-valuetext="Procesando"`); rotating message driven by `currentMessageIndex`; elapsed timer `MM:SS` from `analyzingElapsed`; reassurance copy at `>=30`; pulsing icon on the document preview header.
- [ ] 3.4 Add "failed" variant: error message; timer frozen at last value; no animation.
- [ ] 3.5 Implement the `aria-live="polite"` region that announces "Analizando documento con IA" on first render of analyzing and "Análisis completado" on transition to completed; rotating message container marked `aria-hidden="true"`.
- [ ] 3.6 Add the `MESSAGES` constant with the 5 Spanish strings from `design.md` §"Rotating Messages"; export it for reuse by `page.tsx`.
- [ ] 3.7 Re-run `pnpm --filter web test AnalysisProgress`; all 10 tests pass. REFACTOR only if duplication emerges.

## Phase 4: CSS Keyframes → PR #1

- [ ] 4.1 Add `@keyframes scanLine`, `@keyframes pulseDot`, and `@keyframes fadeInUp` to `apps/web/src/app/globals.css` per `design.md` §"CSS Keyframes".
- [ ] 4.2 Register the three Tailwind utility classes (`.animate-scan-line`, `.animate-pulse-dot`, `.animate-fade-in-up`) via `@theme` in the same file.
- [ ] 4.3 Verify the keyframes render in isolation (open any page with `<div class="animate-scan-line">` and confirm the stripe animates).

## Phase 5: Spec Sync → PR #1

- [ ] 5.1 Update `openspec/specs/shared-contracts/spec.md` to include `"analyzing"` in the `AnalysisResult.status` enum (line missing — code already has it in `packages/contracts/src/schemas.ts`). No code change.

## Phase 6: Integrate into `page.tsx` → PR #2

- [ ] 6.1 In `apps/web/src/app/analysis/page.tsx`, split the existing `isProcessing` (line 331) into `isProcessing = status === "processing"` and `isAnalyzing = status === "analyzing"`; add `showWaitingUI = isProcessing || isAnalyzing`.
- [ ] 6.2 Add `analyzingElapsed` and `messageIndex` state, plus a `useEffect` that (a) resets `analyzingElapsed` to 0 on entering `analyzing`, (b) starts a 1s timer that increments `analyzingElapsed`, (c) starts a 6s interval that advances `messageIndex` (start at 1 because message 0 shows on first render). Cleanup both intervals on unmount or when `isAnalyzing` becomes false.
- [ ] 6.3 Import `AnalysisProgress` and `MESSAGES` from `@/components/analysis/AnalysisProgress`; replace the inline skeleton/percentage blocks (lines 508, 574, 665 area) with `<AnalysisProgress … />` when `showWaitingUI` is true.
- [ ] 6.4 Update the in-page stepper (sub-phases 2-4) so they render "En proceso" + `<Loader2 />` whenever `isAnalyzing` is true (not only when `isProcessing`).
- [ ] 6.5 Update the in-page stepper so sub-phase 1 transitions to "Completado" only when `isCompleted` is true (current behavior treats both processing and analyzing the same — keep that for sub-phase 1).
- [ ] 6.6 Run `pnpm --filter web typecheck` and fix any TypeScript errors introduced by the state split or component import.
- [ ] 6.7 Run `pnpm --filter web test` — all unit + integration tests pass, no regressions.
- [ ] 6.8 Run `pnpm --filter web lint` — no new warnings.

## Phase 7: Manual E2E Verification → PR #2

- [ ] 7.1 Start `pnpm dev:web` and `pnpm dev:api` locally; upload a real PDF (>1 MB) and confirm the indeterminate scan line appears within the first second of `analyzing`.
- [ ] 7.2 Verify the timer increments every second and the message cycles at the 6s mark; confirm the reassurance copy fades in at 30s.
- [ ] 7.3 Run a Playwright smoke test (`apps/web/e2e/analysis-waiting.spec.ts` — new file, optional but recommended) that asserts: aria-live text changes once on phase entry, message swap is `aria-hidden`, file badge persists across the processing→analyzing transition.
- [ ] 7.4 Verify with VoiceOver/NVDA that only the phase change is announced (rotating message swaps are silent).
- [ ] 7.5 Capture before/after Stitch screenshots and attach them to PR #2's description.

## Phase 8: Cleanup → PR #2

- [ ] 8.1 Remove any unused imports, dead variables, or commented-out blocks in `page.tsx` left behind by the inline-skeleton removal.
- [ ] 8.2 Update the proposal's success criteria checklist with check marks and link the two PRs.
- [ ] 8.3 Run the full monorepo test command (`pnpm test`) one last time; confirm green.
