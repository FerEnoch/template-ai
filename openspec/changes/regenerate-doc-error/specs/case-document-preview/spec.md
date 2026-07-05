# Delta for case-document-preview

## MODIFIED Requirements

### Requirement: R4 — Regenerate

A "Regenerar" button MUST re-trigger `POST /api/cases/:id/generate` (not `window.location.reload()`), show the loading screen, and refresh preview on completion. On failure, the button MUST remain enabled for retry without requiring a full page reload.
(Previously: "Reintentar" button triggered `window.location.reload()` instead of a true regenerate retry.)

#### Scenario: Regenerate document from preview

- GIVEN generated text is displayed
- WHEN the user clicks "Regenerar"
- THEN the loading screen appears and preview refreshes with new text on completion

#### Scenario: Regenerate retry after failure

- GIVEN "Regenerar" returns an error
- WHEN the error banner is displayed in Spanish
- THEN the "Reintentar" button is still enabled
- AND clicking it triggers a fresh `POST /api/cases/:id/generate` call

## ADDED Requirements

### Requirement: R6 — Regenerate Error UX

The preview page MUST display a Spanish error banner when regeneration fails. The banner MUST show `errorType` when the API response includes it. The "Reintentar" button MUST retry the `POST /api/cases/:id/generate` call. Plain-text 500 responses MUST produce Spanish fallback text via `parseErrorResponse`.

#### Scenario: Spanish error banner on regenerate failure

- GIVEN "Regenerar" returns a 500 error with plain English body
- WHEN `parseErrorResponse` processes the response
- THEN a Spanish error message is displayed in a banner
- AND the "Reintentar" button is visible and functional

#### Scenario: Error banner with errorType

- GIVEN "Regenerar" returns a 502 with `errorType: "NETWORK_ERROR"`
- WHEN the preview page receives the error response
- THEN the banner displays a Spanish message for that errorType
- AND the errorType is visible for debugging

#### Scenario: Plain-text 500 falls back to Spanish

- GIVEN the API returns status 500 with body "Internal Server Error"
- WHEN `parseErrorResponse` processes it
- THEN a Spanish fallback message is returned instead of the raw English string
