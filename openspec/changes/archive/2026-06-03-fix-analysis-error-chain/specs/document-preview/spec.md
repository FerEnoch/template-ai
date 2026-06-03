# Delta Spec: document-preview

## MODIFIED Requirements

### Requirement: Status polling endpoint

The system MUST use `GET /api/analysis/:id/status` for polling analysis progress. The system MUST NOT poll the mutating `GET /api/analysis/:id` endpoint during active analysis. Frontend code MUST be verified at CI time to ensure no active-polling code path calls `/:id` directly.

(Previously: same endpoint contract; added explicit compliance enforcement to prevent regression.)

#### Scenario: Polling uses status endpoint

- GIVEN a user opens the analysis page for a document under processing
- WHEN the frontend polls for progress
- THEN the request is sent to `/api/analysis/:id/status` (not `/api/analysis/:id`)

#### Scenario: Full result fetched once on completion

- GIVEN analysis status returns `"completed"`
- WHEN the frontend receives the completed status
- THEN the frontend fetches the full result via `GET /api/analysis/:id` exactly once

#### Scenario: No active polling hits mutating endpoint

- GIVEN a static analysis of the polling code in `apps/web/src/app/analysis/page.tsx`
- WHEN CI scans for `fetch.*api/analysis/${id}` (without `/status`) inside the `setInterval` callback
- THEN no match is found
- AND the CI check passes only if all active polling uses the `/status` path

### Requirement: Memory safety

The system MUST clean up polling interval on component unmount and MUST NOT update React state after unmount. The system MUST guard interval callbacks against stale execution — if a callback fires after `clearInterval` or after the component has unmounted, it MUST NOT mutate component state (including `isProcessing`, `analysisResult`, or `error`).

(Previously: covered unmount cleanup; added explicit stale-callback re-entry guard.)

#### Scenario: Interval cleaned on unmount

- GIVEN a user navigates away from the analysis page while polling is active
- WHEN the component unmounts
- THEN the polling interval is cleared and no subsequent state updates occur

#### Scenario: StrictMode double mount safe

- GIVEN React StrictMode causes double mount/unmount cycles
- WHEN effects run multiple times
- THEN cleanup logic prevents duplicate intervals or conflicting state updates

#### Scenario: Stale interval callback does not re-enable processing

- GIVEN the polling interval has been cleared (analysis reached `completed` or `failed`)
- WHEN a pending interval callback fires after `clearInterval` was called (race window)
- THEN the callback checks an `isStale` ref (or equivalent guard) and returns early
- AND `isProcessing` is NOT re-set to `true`
- AND `analysisResult` and `error` state are NOT mutated

## ADDED Requirements

### Requirement: Failed status handling

When the polling status endpoint returns `status: "failed"`, the frontend MUST update the `analysisResult` state (not just set an error) so that `isProcessing` becomes `false` and the UI transitions to the failed state with a retry/error message.

#### Scenario: Failed status clears processing flag

- GIVEN the analysis is in progress (`isProcessing: true`)
- WHEN the polling response returns `status: "failed"`
- THEN the frontend calls `setAnalysisResult(result)` with the failed result
- AND `isProcessing` transitions to `false`
- AND the UI shows the error message instead of "En proceso..."

#### Scenario: Failed status preserves error message

- GIVEN the polling response includes `errorMessage: "AI extraction failed: invalid response"`
- WHEN the frontend updates state for the failed status
- THEN `analysisResult.errorMessage` contains the error message
- AND the UI displays it to the user

#### Scenario: Failed status with empty error message still transitions UI

- GIVEN the polling response returns `status: "failed"` with no error message
- WHEN the frontend updates state
- THEN a fallback error message is shown (e.g., "El análisis falló. Intentá de nuevo")
- AND `isProcessing` is `false`
