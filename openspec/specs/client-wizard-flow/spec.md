# client-wizard-flow Specification

## Purpose

Wire the four existing static screens (upload, analysis, review, save) into a connected multi-step wizard with shared state, sequential validation gating, client-side interactions, and draft persistence.

## Requirements

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

### Requirement: Step validation gating

The system MUST NOT allow `nextStep()` to commit when the current step's validation status is `invalid`. Each step MUST define its own validation rules. The `canProceed` value MUST reflect the current step's validation state.

#### Scenario: Invalid step blocks forward navigation

- GIVEN the upload step has no file selected (validation: invalid)
- WHEN the user calls `nextStep()`
- THEN `currentStep` remains on upload
- AND the step reports a validation error

#### Scenario: Valid step allows forward navigation

- GIVEN the upload step has a valid file selected (validation: valid)
- WHEN the user calls `nextStep()`
- THEN `currentStep` advances to analysis

### Requirement: URL state synchronization

The system MUST synchronize `currentStep` with the URL search param `?step=N`. On mount, the system MUST read the step from URL first. On step change, the system MUST update the URL without full page reload.

#### Scenario: Browser refresh preserves step

- GIVEN the user is on step 2 (analysis) with `?step=2` in the URL
- WHEN the browser is refreshed
- THEN the wizard restores to step 2

#### Scenario: Browser back navigates to previous step

- GIVEN the user navigated from step 1 to step 2
- WHEN the user presses browser back
- THEN the wizard returns to step 1

### Requirement: Upload drag and drop

The upload step MUST support HTML5 drag and drop on the dropzone. The system MUST validate file type (PDF, DOCX, JPG) and file size (max 25 MB) using Zod schemas. Invalid files MUST display an inline error. Valid files MUST show a file card with name, size, and remove action.

#### Scenario: Valid file accepted via drop

- GIVEN the dropzone is visible
- WHEN the user drops a 2 MB PDF file
- THEN the file card appears with filename and size
- AND step validation becomes valid

#### Scenario: Oversized file rejected

- GIVEN the dropzone is visible
- WHEN the user drops a 30 MB PDF file
- THEN an inline error displays "El archivo excede el límite de 25 MB"
- AND step validation remains invalid

### Requirement: Upload progress and navigation

After a valid file is accepted, the system MUST display an animated progress indicator. On completion, the system MUST auto-navigate to the analysis step.

#### Scenario: Upload completes and navigates

- GIVEN a valid file is being uploaded
- WHEN the mock upload reaches 100%
- THEN the wizard auto-calls `nextStep()` to analysis

### Requirement: Analysis polling

The analysis step MUST poll the mock API at intervals. The system MUST render skeleton placeholders until data arrives. On data arrival, the system MUST transition from skeleton to content with a CSS animation. The system MUST differentiate the `processing` and `analyzing` statuses: `processing` shows determinate progress with sub-phase 2 active; `analyzing` activates the friendly waiting UI from `analysis-waiting-ui` and progresses sub-phases 2–4.

(Previously: both statuses were treated identically as `isProcessing` — same skeleton, same single-sub-phase stepper, no distinction during the 20–30s AI wait)

#### Scenario: Skeleton shown during polling

- GIVEN the analysis step just loaded
- WHEN no API response has arrived yet
- THEN skeleton placeholders are visible

#### Scenario: Content replaces skeleton on data

- GIVEN the analysis step is polling
- WHEN the mock API returns entity data
- THEN skeletons fade out and entity previews render

#### Scenario: Processing status shows determinate UI

- GIVEN the status endpoint returns "processing" with progress 50
- WHEN the polling cycle updates state
- THEN a determinate progress bar renders at 50%
- AND only sub-phase 2 of the in-page stepper is active

#### Scenario: Analyzing status shows friendly waiting UI

- GIVEN the status endpoint returns "analyzing"
- WHEN the polling cycle updates state
- THEN the AnalysisProgress component renders (indeterminate bar, rotating messages, elapsed timer)
- AND the in-page stepper shows sub-phases 2–4 as "En proceso"

### Requirement: Analysis sub-phase stepper

The analysis step MUST render an in-page stepper with 4 sub-phases (Validating file, Extracting text, Detecting structure, Identifying case data). The stepper MUST differentiate status: when `status === "analyzing"`, sub-phases 2–4 all display "En proceso" with spinner icons; when `status === "processing"`, only sub-phase 2 displays "En proceso". The stepper MUST never freeze on a single sub-phase during the AI wait. The stepper MUST remain independent of the top-level wizard `StepIndicator`.

#### Scenario: All sub-phases active during analyzing

- GIVEN the analysis status is "analyzing"
- WHEN the in-page stepper renders
- THEN sub-phase 1 shows "Completado"
- AND sub-phases 2, 3, 4 all show "En proceso" with spinner icons

#### Scenario: Only sub-phase 2 active during processing

- GIVEN the analysis status is "processing"
- WHEN the in-page stepper renders
- THEN only sub-phase 2 shows "En proceso"
- AND sub-phases 3 and 4 show "Pendiente"

#### Scenario: All sub-phases completed

- GIVEN the analysis status transitions to "completed"
- WHEN the in-page stepper renders
- THEN all 4 sub-phases show "Completado"

### Requirement: Review entity interaction

The review step MUST display entity groups in expand/collapse panels. Each entity MUST show a confidence badge (ALTA, MEDIA, BAJA). The system MUST filter entities by confidence level. Entity rows MUST be clickable to open the edit modal. Excluded entities MUST be visually distinguished (strikethrough or dimmed) and filtered out by default. The review step MUST also render `state.extractedText` with entity highlights overlaid, reusing the same `renderHighlightedText()` utility (or a shared equivalent) for consistency. When `extractedText` is `null` or empty, the document preview area MUST show a fallback message ("Vista previa no disponible") instead of any hardcoded template.

(Previously: Entity rows were display-only with no click interaction or exclusion state; document preview used a hardcoded template)

#### Scenario: Entity group expands on click

- GIVEN the "Partes" group is collapsed
- WHEN the user clicks the group header
- THEN the entity list expands showing individual fields

#### Scenario: Confidence filter reduces visible entities

- GIVEN entities with mixed confidence levels exist
- WHEN the user selects "ALTA only" filter
- THEN only high-confidence entities are shown

#### Scenario: Entity row opens edit modal

- GIVEN the review step displays entities
- WHEN the user clicks an entity row
- THEN the edit modal opens with the entity's details

#### Scenario: Excluded entity visually distinguished

- GIVEN an entity is marked as excluded
- WHEN the review step renders
- THEN the entity row shows a strikethrough or dimmed appearance

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

### Requirement: Entity edit modal integration

The review step MUST allow clicking any entity row to open an edit modal. The modal changes MUST be reflected in the wizard state immediately (optimistic update). If the API call fails, the review step MUST display an inline error.

#### Scenario: Entity click opens modal

- GIVEN the review step displays entities
- WHEN the user clicks an entity row
- THEN an edit modal appears

#### Scenario: Inline error on API failure

- GIVEN the user confirms an entity edit
- WHEN the API call fails
- THEN an inline error appears on the review step

### Requirement: Save form validation

The save step MUST use react-hook-form with Zod resolver. The template name field is required. Description is optional. On submit, the system MUST call the mock save API and display a success state.

#### Scenario: Submit with valid form

- GIVEN the template name is "Contrato de Arrendamiento"
- WHEN the user submits the form
- THEN the mock API is called and a success message appears

#### Scenario: Submit with empty name blocked

- GIVEN the template name field is empty
- WHEN the user attempts to submit
- THEN a validation error appears on the name field

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
