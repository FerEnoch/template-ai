# Archive: fix-review-extracted-text-flow

**Archived:** 2026-06-02
**Status:** COMPLETE ✅

---

## Overview

Fixed the extracted text flow between the analysis and review pages. The analysis page was rendering a document preview with entity highlights and entity list — these belong on the review page. The review page was using a hardcoded template instead of real extracted text. Additionally, AI-generated `sourceSpan` offsets were approximate with no post-validation to correct them.

**Root causes fixed:**
1. `extractedText` was never wired through `WizardState`/`WizardContext`/`wizardReducer`/`saveDraft`
2. The AI prompt produced approximate spans with no backend correction

---

## Implementation

### Phase 1 — Frontend Data Flow (PR 1)

**PR:** https://github.com/FerEnoch/template-ai/pull/1 (`fix-review-extracted-text-flow-pr1`)

Wired `extractedText` through the wizard pipeline:
- Added `extractedText: string | null` to `WizardState` interface
- Updated `wizardReducer` `SET_ANALYSIS_RESULT` to accept and store `extractedText`
- Updated `WizardContext.setWizardAnalysisResult()` signature to pass `extractedText`
- Refactored `saveDraft()` to options-object signature (`SaveDraftInput`) including `extractedText`
- Created shared `renderHighlightedText()` utility in `lib/wizard/highlightText.tsx`
- Removed right column (document preview + entity list) from analysis page; simplified to single-column CTA layout
- Replaced hardcoded template in review page with `renderHighlightedText(state.extractedText, state.entities)`
- Updated `WizardDraftSchema` to include optional `extractedText` field
- Added fallback "Vista previa no disponible" when `extractedText` is null/empty

### Phase 2 — Backend Highlight Accuracy (PR 2)

**PR:** https://github.com/FerEnoch/template-ai/pull/2 (`fix-review-extracted-text-flow-pr2`)

Added post-validation for AI-emitted sourceSpan offsets:
- Implemented `validateAndCorrectSpans()` in `document-analysis.service.ts`
- Per-entity case-sensitive `indexOf` search against actual `extractedText`
  - 1 match → exact span replacement
  - N matches → closest to `aiSpan.start`
  - 0 match → `sourceSpan = undefined`
- Wired post-validation into `analyze()` before returning result
- Changed prompt wording from "posición aproximada" → "posición exacta"

### Key Decisions

| # | Decision | Choice | Rationale |
|---|----------|--------|-----------|
| 1 | Shared highlighter location | `lib/wizard/highlightText.tsx` | Single source used by both analysis and review pages |
| 2 | `saveDraft` signature | Options object `SaveDraftInput` | Avoids 5th positional param, cleaner call sites |
| 3 | `WizardState.extractedText` type | `string \| null` | `null` = not-yet-loaded; review falls back gracefully |
| 4 | Post-validation case sensitivity | Case-sensitive initial | Spec-mandated; case-insensitive can be added later |
| 5 | New DB column for extractedText? | **No** | Already stored via existing `saveExtractedText` + column |
| 6 | Post-validation location | Inside `DocumentAnalysisService.analyze()` | Holds both `fileContent` and `entities`; pure, testable |

---

## Test Results

| Suite | Tests | Status |
|-------|-------|--------|
| Web (`@template-ai/web`) | 73 tests (6 files) | ✅ ALL PASS |
| API (`@template-ai/api`) | 246 tests (27 files) | ✅ 243 PASS, 3 pre-existing failures |
| **Total** | **316 tests** | **✅ All targeted tests pass** |

- **3 pre-existing failures** in `bootstrap.boundaries.spec.ts` — unrelated architectural boundary tests
- **19 `document-analysis.service.spec.ts` tests** — ALL PASS (including all 7 validateAndCorrectSpans tests)
- **TypeScript compilation** — clean across `web`, `api`, and `contracts`

### Spec Compliance

**18/18 scenarios PASS** ✅

- client-wizard-flow: 12 scenarios (state, draft, review render, analysis layout, fallbacks)
- shared-contracts: 6 scenarios (entity schema, analysis result, sourceSpan validation)

---

## Files Changed

### Phase 1 (PR 1)
| File | Action |
|------|--------|
| `packages/contracts/src/schemas.ts` | Modified — `WizardDraftSchema.extractedText` |
| `apps/web/src/lib/wizard/types.ts` | Modified — `WizardState.extractedText`, action payload |
| `apps/web/src/lib/wizard/wizardReducer.ts` | Modified — handle `extractedText` in actions |
| `apps/web/src/lib/wizard/highlightText.tsx` | Created — shared render utility |
| `apps/web/src/lib/wizard/WizardContext.tsx` | Modified — signature + dispatch |
| `apps/web/src/lib/wizard/storage.ts` | Modified — `SaveDraftInput` + persist |
| `apps/web/src/lib/wizard/index.ts` | Modified — export highlighter |
| `apps/web/src/app/upload/page.tsx` | Modified — `saveDraft({ file })` |
| `apps/web/src/app/analysis/page.tsx` | Modified — pass text, remove right column |
| `apps/web/src/app/review/page.tsx` | Modified — real text + highlights |

### Phase 2 (PR 2)
| File | Action |
|------|--------|
| `apps/api/src/ai/document-analysis.service.ts` | Modified — `validateAndCorrectSpans()` |
| `apps/api/src/ai/open-router.service.ts` | Modified — prompt wording |

---

## Artifact Chain

| Artifact | Path |
|----------|------|
| Proposal | `openspec/changes/archive/2026-06-02-fix-review-extracted-text-flow/proposal.md` |
| Spec (client-wizard-flow) | `openspec/changes/archive/2026-06-02-fix-review-extracted-text-flow/specs/client-wizard-flow/spec.md` |
| Spec (shared-contracts) | `openspec/changes/archive/2026-06-02-fix-review-extracted-text-flow/specs/shared-contracts/spec.md` |
| Design | `openspec/changes/archive/2026-06-02-fix-review-extracted-text-flow/design.md` |
| Tasks | `openspec/changes/archive/2026-06-02-fix-review-extracted-text-flow/tasks.md` |
| Verify Report | `openspec/changes/archive/2026-06-02-fix-review-extracted-text-flow/verify-report.md` |
| Archive Report | `openspec/changes/archive/2026-06-02-fix-review-extracted-text-flow/archive.md` |
| Main Spec (client-wizard-flow) | `openspec/specs/client-wizard-flow/spec.md` |
| Main Spec (shared-contracts) | `openspec/specs/shared-contracts/spec.md` |

### Engram Memory Chain
- `sdd/fix-review-extracted-text-flow/proposal` (#747)
- `sdd/fix-review-extracted-text-flow/spec` (#748)
- `sdd/fix-review-extracted-text-flow/design` (#749)
- `sdd/fix-review-extracted-text-flow/tasks` (#750)
- `sdd/fix-review-extracted-text-flow/apply-progress` (#751)
- `sdd/fix-review-extracted-text-flow/verify-report` (#752)
- `sdd/fix-review-extracted-text-flow/archive-report` (this report)

---

## SDD Cycle Complete

The change has been fully planned, implemented, verified, and archived.
