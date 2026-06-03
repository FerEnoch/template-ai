# Delta for client-wizard-flow

## MODIFIED Requirements

### Requirement: Wizard state machine

The system MUST maintain wizard state via React Context (`useReducer`). State MUST include `extractedText: string | null` carrying the analysis API's document text. Steps MUST be ordered: upload → analysis → review → save. Each step MUST track its own validation status (pending, valid, invalid). The system MUST expose `currentStep`, `nextStep()`, `prevStep()`, and `canProceed` through a `useWizard` hook.

(Previously: state tracked steps, validation, and navigation only)

#### Scenario: Step navigation follows fixed order

- GIVEN the wizard is initialized
- WHEN the user calls `nextStep()`
- THEN `currentStep` advances to the next step in sequence

#### Scenario: Back navigation is always allowed

- GIVEN the user is on step 3 (review)
- WHEN the user calls `prevStep()`
- THEN `currentStep` returns to step 2 (analysis)

#### Scenario: SET_ANALYSIS_RESULT stores extractedText

- GIVEN the analysis API returns a result with `extractedText`
- WHEN the reducer receives `SET_ANALYSIS_RESULT`
- THEN `state.extractedText` equals the API's value

#### Scenario: Backward navigation to UPLOAD clears extractedText

- GIVEN state has `extractedText` set
- WHEN the user navigates back to UPLOAD
- THEN `clearDownstreamState()` resets `extractedText` to `null`

### Requirement: Draft persistence

The system MUST persist wizard state to localStorage keyed `template-draft:v1`. The draft MUST include `extractedText` alongside existing fields. `WizardDraftSchema` MUST validate `extractedText` (optional, defaulting to empty string for legacy drafts). On mount, the system MUST restore from draft if it exists. Draft MUST be cleared on successful save or explicit cancel.

(Previously: draft persisted core wizard fields only)

#### Scenario: Draft restored on page reload

- GIVEN the user uploaded a file and navigated to step 2
- WHEN the page is reloaded
- THEN the wizard restores to step 2 with the file reference intact

#### Scenario: Draft cleared after save

- GIVEN a draft exists in localStorage
- WHEN the save step completes successfully
- THEN `template-draft:v1` is removed from localStorage

#### Scenario: saveDraft persists extractedText

- GIVEN state has `extractedText` set
- WHEN `saveDraft()` is called
- THEN localStorage `template-draft:v1` contains the value

#### Scenario: Legacy draft without extractedText loads

- GIVEN a legacy draft that omits `extractedText`
- WHEN parsed by `WizardDraftSchema`
- THEN validation succeeds and the field defaults to empty string

### Requirement: Review entity interaction

The review step MUST display entity groups in expand/collapse panels. Each entity MUST show a confidence badge (ALTA, MEDIA, BAJA). The system MUST filter entities by confidence level. The review step MUST also render `state.extractedText` with entity highlights overlaid, reusing the same `renderHighlightedText()` utility (or a shared equivalent) for consistency. When `extractedText` is `null` or empty, the document preview area MUST show a fallback message ("Vista previa no disponible") instead of any hardcoded template.

(Previously: document preview used a hardcoded template)

#### Scenario: Entity group expands on click

- GIVEN the "Partes" group is collapsed
- WHEN the user clicks the group header
- THEN the entity list expands showing individual fields

#### Scenario: Confidence filter reduces visible entities

- GIVEN entities with mixed confidence levels exist
- WHEN the user selects "ALTA only" filter
- THEN only high-confidence entities are shown

#### Scenario: Review renders extracted text with highlights

- GIVEN `state.extractedText` and entities with `sourceSpan` exist
- WHEN the review step renders
- THEN the document area shows the extracted text with `sourceSpan` characters highlighted

#### Scenario: Review reuses the same highlighter

- GIVEN the project has a `renderHighlightedText()` utility
- WHEN the review step renders highlights
- THEN it invokes the same function (or a shared equivalent)

#### Scenario: Fallback when extractedText is missing

- GIVEN `state.extractedText` is `null` or empty
- WHEN the review step renders
- THEN the preview area shows "Vista previa no disponible"

## ADDED Requirements

### Requirement: Analysis page completed layout

The analysis page MUST treat the `completed` status as a final summary state. When status is `completed`, the page MUST render a single-column centered layout with: (1) a completion confirmation, (2) a confidence summary, and (3) a prominent "Continuar a Revisión" CTA. The page MUST NOT render the document preview or entity list when completed — those belong on the review page. On completion, the page MUST call `setWizardAnalysisResult()` AND `saveDraft()` with the full result, including `extractedText`, so state and the localStorage draft stay in sync before navigation.

#### Scenario: Completed analysis shows CTA-only layout

- GIVEN status is "completed"
- WHEN the analysis page renders
- THEN it shows: completion confirmation, confidence summary, and "Continuar a Revisión" button
- AND no document preview or entity list is rendered

#### Scenario: Completed analysis wires extractedText to state and draft

- GIVEN the API returns a result with `extractedText`
- WHEN the completed state is committed
- THEN `setWizardAnalysisResult(fullResult)` is called with `extractedText`
- AND `saveDraft()` is called with the same payload

#### Scenario: CTA navigates to review with text available

- GIVEN the completed state is showing
- WHEN the user clicks "Continuar a Revisión"
- THEN the wizard advances to review
- AND `state.extractedText` is available for the review page
