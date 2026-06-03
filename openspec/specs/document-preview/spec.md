# Document Preview Specification

## Purpose

Render extracted document text with entity highlighting in the analysis preview panel. Replaces skeleton wireframes with real content and provides graceful degradation for legacy analyses.

## Requirements

### Requirement: Status polling endpoint

The system MUST use `GET /api/analysis/:id/status` for polling analysis progress. The system MUST NOT poll the mutating `GET /api/analysis/:id` endpoint during active analysis.

#### Scenario: Polling uses status endpoint

- GIVEN a user opens the analysis page for a document under processing
- WHEN the frontend polls for progress
- THEN the request is sent to `/api/analysis/:id/status` (not `/api/analysis/:id`)

#### Scenario: Full result fetched once on completion

- GIVEN analysis status returns `"completed"`
- WHEN the frontend receives the completed status
- THEN the frontend fetches the full result via `GET /api/analysis/:id` exactly once

### Requirement: Polling timeout

The system MUST allow at least 45 seconds for AI analysis to complete. The system SHOULD show a "still analyzing" message if analysis exceeds the polling window.

#### Scenario: Timeout shows still analyzing message

- GIVEN an analysis has been polling for more than 45 seconds without completion
- WHEN the elapsed time threshold is reached
- THEN the UI displays "still analyzing" instead of an error

#### Scenario: Analysis completes within extended window

- GIVEN an analysis that takes 20 seconds to complete
- WHEN MAX_POLLING_ATTEMPTS is set to 60 with 800ms intervals
- THEN the analysis completes without timeout (60 × 800ms = 48s window)

### Requirement: Preview rendering

The system MUST render extracted text in the preview area when `extractedText` is present.

#### Scenario: Extracted text displayed

- GIVEN an analysis result with `extractedText: "Invoice #123..."`
- WHEN the analysis page renders
- THEN the preview area displays the extracted text

#### Scenario: Entities highlighted with tooltips

- GIVEN an analysis result with extracted text and entities that have `sourceSpan` data
- WHEN the preview renders
- THEN entity spans are highlighted and hovering shows a tooltip with entity label and value

### Requirement: Graceful degradation for legacy analyses

The system MUST show "Preview unavailable" for analyses where `extractedText` is null.

#### Scenario: Legacy analysis shows placeholder

- GIVEN an analysis result created before this feature with `extractedText: null`
- WHEN the preview area renders
- THEN "Preview unavailable" is shown without errors

### Requirement: Memory safety

The system MUST clean up polling interval on component unmount and MUST NOT update React state after unmount.

#### Scenario: Interval cleaned on unmount

- GIVEN a user navigates away from the analysis page while polling is active
- WHEN the component unmounts
- THEN the polling interval is cleared and no subsequent state updates occur

#### Scenario: StrictMode double mount safe

- GIVEN React StrictMode causes double mount/unmount cycles
- WHEN effects run multiple times
- THEN cleanup logic prevents duplicate intervals or conflicting state updates
