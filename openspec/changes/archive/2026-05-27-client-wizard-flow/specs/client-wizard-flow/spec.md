# client-wizard-flow Specification

## Purpose

Wire the four existing static screens (upload, analysis, review, save) into a connected multi-step wizard with shared state, sequential validation gating, client-side interactions, and draft persistence.

## Requirements

### Requirement: Wizard state machine

The system MUST maintain wizard state via React Context (`useReducer`). Steps MUST be ordered: upload → analysis → review → save. Each step MUST track its own validation status (pending, valid, invalid). The system MUST expose `currentStep`, `nextStep()`, `prevStep()`, and `canProceed` through a `useWizard` hook.

#### Scenario: Step navigation follows fixed order

- GIVEN the wizard is initialized
- WHEN the user calls `nextStep()`
- THEN `currentStep` advances to the next step in sequence

#### Scenario: Back navigation is always allowed

- GIVEN the user is on step 3 (review)
- WHEN the user calls `prevStep()`
- THEN `currentStep` returns to step 2 (analysis)

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

The analysis step MUST poll the mock API at intervals. The system MUST render skeleton placeholders until data arrives. On data arrival, the system MUST transition from skeleton to content with a CSS animation.

#### Scenario: Skeleton shown during polling

- GIVEN the analysis step just loaded
- WHEN no API response has arrived yet
- THEN skeleton placeholders are visible

#### Scenario: Content replaces skeleton on data

- GIVEN the analysis step is polling
- WHEN the mock API returns entity data
- THEN skeletons fade out and entity previews render

### Requirement: Review entity interaction

The review step MUST display entity groups in expand/collapse panels. Each entity MUST show a confidence badge (ALTA, MEDIA, BAJA). The system MUST filter entities by confidence level.

#### Scenario: Entity group expands on click

- GIVEN the "Partes" group is collapsed
- WHEN the user clicks the group header
- THEN the entity list expands showing individual fields

#### Scenario: Confidence filter reduces visible entities

- GIVEN entities with mixed confidence levels exist
- WHEN the user selects "ALTA only" filter
- THEN only high-confidence entities are shown

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

The system MUST persist wizard state to localStorage keyed `template-draft:v1`. On mount, the system MUST restore from draft if it exists. Draft MUST be cleared on successful save or explicit cancel.

#### Scenario: Draft restored on page reload

- GIVEN the user uploaded a file and navigated to step 2
- WHEN the page is reloaded
- THEN the wizard restores to step 2 with the file reference intact

#### Scenario: Draft cleared after save

- GIVEN a draft exists in localStorage
- WHEN the save step completes successfully
- THEN `template-draft:v1` is removed from localStorage
