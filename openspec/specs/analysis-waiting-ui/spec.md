# analysis-waiting-ui Specification

## Purpose

Provide a friendly, informative waiting experience during the AI analysis phase (20–30s) that replaces the current indistinguishable `processing` UI. The waiting UI MUST acknowledge the wait, communicate ongoing activity, surface the file being analyzed, and remain accessible to screen reader users.

## Requirements

### Requirement: Indeterminate progress during AI analysis

The system MUST render an indeterminate progress animation (continuous stripe or glow) when `status === "analyzing"`, replacing the determinate bar with a numeric percentage. The animation MUST stop when status transitions to `completed`, `failed`, or back to `processing`. The system MUST NOT show a numeric progress value during the indeterminate phase.

#### Scenario: Stripe animation during analyzing

- GIVEN the analysis status is "analyzing"
- WHEN the waiting UI renders
- THEN a continuous stripe animation appears
- AND no numeric percentage is shown

#### Scenario: Indeterminate stops on terminal status

- GIVEN the indeterminate animation is running
- WHEN the status transitions to "completed"
- THEN the animation stops
- AND a determinate completion state renders

### Requirement: Rotating status messages

The system MUST display a rotating message describing AI activity, cycling every 5–6 seconds with a fade transition. The system MUST provide at least 4 distinct messages (e.g., reading, identifying entities, detecting dates, organizing info). The system MUST NOT rely on backend sub-phase data — messages are best-effort cosmetic copy.

#### Scenario: First message renders on analyzing entry

- GIVEN the analysis status transitions to "analyzing"
- WHEN the waiting UI mounts
- THEN the first message displays within 500ms
- AND the message describes the AI reading the document

#### Scenario: Message cycles on interval

- GIVEN the waiting UI has shown message N for 6 seconds
- WHEN the interval elapses
- THEN message N+1 fades in
- AND message N fades out with a CSS transition

### Requirement: Elapsed time display

The system MUST render an elapsed time counter in `MM:SS` format that updates every second while `status === "analyzing"`. The counter MUST reset to `00:00` when the status leaves `analyzing` (including a brief flicker back to `processing`).

#### Scenario: Counter increments every second

- GIVEN the analysis status is "analyzing" and the counter reads "00:05"
- WHEN 1 second elapses
- THEN the counter reads "00:06"

#### Scenario: Counter freezes on terminal status

- GIVEN the counter reads "00:24"
- WHEN the status transitions to "completed"
- THEN the counter stops updating
- AND the final value is preserved

### Requirement: Accessible progress announcements

The system MUST wrap phase-change announcements in an `aria-live="polite"` region so screen readers announce transitions (e.g., upload complete → analyzing → completed). The system MUST NOT announce every rotating message swap — only meaningful phase changes.

#### Scenario: Phase change announced once

- GIVEN the analysis status transitions from "processing" to "analyzing"
- WHEN the waiting UI updates
- THEN a screen reader announces "Analizando documento con IA" exactly once
- AND no further announcements fire for the duration of the analyzing phase

#### Scenario: Rotating message swap silent for screen readers

- GIVEN a rotating message changes every 6 seconds
- WHEN the message swaps
- THEN no `aria-live` event fires
- AND the swap is purely visual

### Requirement: File info badge during analysis

The system MUST display a prominent badge with the uploaded file's filename and formatted human-readable size while `status` is `processing` or `analyzing`. The badge MUST remain mounted throughout both phases without flicker.

#### Scenario: Badge shows filename and size

- GIVEN a 2.4 MB PDF named "contrato.pdf" was uploaded
- WHEN the analysis is in progress
- THEN a badge displays "contrato.pdf" and "2.4 MB" above the wait content

#### Scenario: Badge persists across status transitions

- GIVEN the badge is visible during "processing"
- WHEN the status transitions to "analyzing"
- THEN the badge remains visible without remounting
- AND the filename and size values are unchanged
