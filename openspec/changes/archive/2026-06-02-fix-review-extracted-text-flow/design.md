# Design: Fix Review Extracted Text Flow

## Technical Approach

Two independent phases. **Phase 1** threads `extractedText` through the existing
wizard data pipeline (`contracts → types → reducer → context → storage →
analysis page → review page`) so the review step renders the REAL document text
instead of a hardcoded template. **Phase 2** adds a pure post-validation pass in
the backend that corrects AI-emitted `sourceSpan` offsets against the actual
extracted text.

Maps to proposal Phase 1 (frontend data flow, ~80 LOC) and Phase 2 (backend
highlight accuracy, ~35 LOC). Specs covered: `client-wizard-flow` (state +
draft + review render), `shared-contracts` (WizardDraft field + sourceSpan
post-validation).

Key constraint discovered: `AnalysisResultSchema.extractedText` **already
exists** (`schemas.ts:43`) and the backend **already persists** text via
`saveExtractedText` (`analysis.service.ts:191`). So Phase 1 contract work is
only `WizardDraftSchema`, and Phase 2 needs NO new DB column.

## Architecture Decisions

| # | Decision | Choice | Rejected | Rationale |
|---|----------|--------|----------|-----------|
| 1 | Where does `renderHighlightedText` live? | Extract to shared util `lib/wizard/highlightText.tsx`, import in BOTH pages | Duplicate into review page | Spec scenario "reuses the same highlighter" mandates a single source. Analysis page keeps working by importing from the same util during the transition. |
| 2 | `saveDraft` signature shape | Refactor to a single options object `saveDraft(input: SaveDraftInput)` | Append 5th positional `extractedText` param | 4 positional params already; a 5th (after optional `templateForm`) is error-prone. One options object is the project-safe path and updates 3 call sites cleanly. |
| 3 | Exclude large `extractedText` from localStorage? | Persist as-is, no size cap in this change | Truncate / size threshold | Documents are ≤25 MB files but extracted TEXT is small; localStorage 5 MB quota is ample for legal-doc text. Add a cap only if a real quota error appears (out of scope). |
| 4 | Post-validation case sensitivity | Case-sensitive `indexOf` (spec-mandated initial) | Case-insensitive | Spec REQ "sourceSpan post-validation" mandates case-sensitive initially. |
| 5 | New PostgreSQL column for `extractedText`? | **No** — already stored via `saveExtractedText` + `extracted_text` column | Add entities-table column | Column already exists (`analysis-results.repository.ts:153`). Already wired end-to-end. |
| 6 | Where does post-validation run? | Inside `DocumentAnalysisService.analyze()` before return — it holds both `fileContent` and `entities` | In `analysis.service.ts` mapping loop | `analyze()` already owns text+entities together; keeps the correction pure, unit-testable, DB-free. |
| 7 | `WizardState.extractedText` type | `string | null` (matches spec + AnalysisResult) | `string` default `""` | Spec REQ "state MUST include extractedText: string | null". `null` = not-yet-loaded; review fallback checks null/empty. |

## Data Flow

### BEFORE (broken)

    analysis API ──extractedText──> (dropped)
                   │
    setWizardAnalysisResult(id, entities)  ← text never passed
                   │
    WizardState { entities }  ← no extractedText
                   │
    review/page.tsx ──> HARDCODED template (Madrid lease)

### AFTER (fixed)

    analysis API ──> { entities, extractedText }
                          │
    setWizardAnalysisResult(id, entities, extractedText)
    saveDraft({ file, id, entities, extractedText })
                          │
    SET_ANALYSIS_RESULT ──> WizardState { entities, extractedText }
                          │                    │
                   localStorage draft     review/page.tsx
                   (WizardDraftSchema)          │
                                          renderHighlightedText(
                                            state.extractedText, state.entities)
                                          │ null/empty → "Vista previa no disponible"

### Phase 2 backend correction

    AI entities (approx spans) + fileContent
                  │
    validateAndCorrectSpans(entities, fileContent)
       per entity: indexOf(value)
         1 match  → exact span
         N matches→ closest to aiSpan.start
         0 match  → sourceSpan = undefined
                  │
    AnalyzeResult.entities (corrected spans)

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `packages/contracts/src/schemas.ts` | Modify | Add `extractedText: z.string().nullable().optional()` to `WizardDraftSchema`. (`AnalysisResultSchema` already has it.) |
| `apps/web/src/lib/wizard/types.ts` | Modify | Add `extractedText: string \| null` to `WizardState`; add `extractedText` to `SET_ANALYSIS_RESULT` action payload. |
| `apps/web/src/lib/wizard/wizardReducer.ts` | Modify | `initialWizardState.extractedText = null`; handle in `SET_ANALYSIS_RESULT`, `SET_DRAFT`, `LOAD_DRAFT`; `clearDownstreamState` resets it to `null` for UPLOAD. |
| `apps/web/src/lib/wizard/highlightText.tsx` | Create | Extracted shared `renderHighlightedText(text, entities)` (moved from analysis page). |
| `apps/web/src/lib/wizard/WizardContext.tsx` | Modify | `setAnalysisResult(id, entities, extractedText)` signature + dispatch. |
| `apps/web/src/lib/wizard/storage.ts` | Modify | `saveDraft(input: SaveDraftInput)` object signature incl. `extractedText`; persist it. |
| `apps/web/src/lib/wizard/index.ts` | Modify | Export `renderHighlightedText` from new util. |
| `apps/web/src/app/upload/page.tsx` | Modify | Update `saveDraft(file)` → `saveDraft({ file })` (call-site only). |
| `apps/web/src/app/analysis/page.tsx` | Modify | Pass `extractedText` at both commit sites (L321/322, L393/394); REMOVE right column (L782–940); simplified single-column completed layout; import highlighter from util. |
| `apps/web/src/app/review/page.tsx` | Modify | Replace hardcoded `<article>` (L125–206) with `renderHighlightedText(state.extractedText, state.entities)`; null/empty → "Vista previa no disponible". |
| `apps/api/src/ai/document-analysis.service.ts` | Modify | Add `validateAndCorrectSpans()`; call before returning entities in `analyze()`. |
| `apps/api/src/ai/open-router.service.ts` | Modify (optional) | Prompt wording "posición aproximada" → "posición exacta". |

## Interfaces / Contracts

```ts
// types.ts
export interface WizardState {
  /* ...existing... */
  extractedText: string | null;
}
export type WizardAction =
  | { type: "SET_ANALYSIS_RESULT"; analysisResultId: string;
      entities: Entity[]; extractedText: string | null }
  /* ...rest unchanged... */;

// storage.ts
export interface SaveDraftInput {
  file: WizardDraft["file"];
  analysisResultId?: string;
  entities?: WizardDraft["entities"];
  templateForm?: WizardDraft["templateForm"];
  extractedText?: string | null;
}
export function saveDraft(input: SaveDraftInput): void;

// WizardContext.tsx
setAnalysisResult: (
  analysisResultId: string,
  entities: WizardState["entities"],
  extractedText: string | null,
) => void;

// highlightText.tsx (shared)
export function renderHighlightedText(
  text: string, entities: Entity[],
): React.ReactNode;

// document-analysis.service.ts (Phase 2)
function validateAndCorrectSpans(
  entities: AnalyzeResult["entities"],
  extractedText: string,
): AnalyzeResult["entities"];
```

`validateAndCorrectSpans` logic: for each entity, collect all `indexOf` matches
of `entity.value` (case-sensitive). One match → exact span. Multiple → pick the
match minimizing `|matchStart − aiSpan.start|` (fallback to first if no aiSpan).
Zero → `sourceSpan = undefined`.

## Edge Case Handling

| Case | Handling |
|------|----------|
| Legacy draft without `extractedText` | Schema field optional → defaults; reducer coerces to `null` |
| `state.extractedText === null` or `""` on review | Render "Vista previa no disponible" fallback |
| Back-nav to UPLOAD | `clearDownstreamState` resets `extractedText` to `null` |
| Entity value not in text (OCR drift) | `sourceSpan = undefined`; highlighter skips it; entity still editable |
| Duplicate value (e.g. "Lima" ×3) | Closest match to AI offset selected |
| Empty entities | Highlighter returns plain `<span>{text}</span>` |
| localStorage quota | Out of scope (decision #3); text is small |

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | `validateAndCorrectSpans` | Cover spec scenarios: exact-replace, multi-match disambiguation, no-match→undefined, case-sensitive miss. Extend `document-analysis.service.spec.ts`. |
| Unit | `wizardReducer` | `SET_ANALYSIS_RESULT` stores text; UPLOAD nav clears to `null`; SET/LOAD_DRAFT carry text. |
| Unit | `saveDraft`/`loadDraft` | Persists+restores `extractedText`; legacy draft omitting it still loads. Update `storage.test.ts` to object signature. |
| Unit | `renderHighlightedText` | Highlights spans; skips undefined-span entities; empty-entity passthrough. |
| Integration | Contracts | `WizardDraftSchema` parses with and without `extractedText`. |
| E2E (manual) | Review render | Completed analysis → review shows real text + aligned highlights; null → fallback message; analysis page single-column CTA-only. |

## Migration / Rollout

No DB migration — `extracted_text` column already exists and is populated.
`WizardDraftSchema.extractedText` is optional, so existing localStorage drafts
load unchanged (field defaults to `null`). Backend post-validation is pure and
additive; removing it restores prior approximate-span behavior. Rollback =
revert the changed files.

## Open Questions

- [ ] None blocking. Decision #2 (`saveDraft` → options object) touches 3 call
      sites incl. `storage.test.ts`; flagged so tasks/apply update all of them
      together to avoid a broken intermediate build.
