# Delta for client-wizard-flow

## ADDED Requirements

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

## MODIFIED Requirements

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
