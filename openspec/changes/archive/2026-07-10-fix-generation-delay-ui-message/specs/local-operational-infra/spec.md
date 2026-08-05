# Delta for local-operational-infra

## MODIFIED Requirements

### Requirement: Reduced request timeout for the API

The API server MUST use a `requestTimeout` of 30 seconds instead of the previous 10 minutes. The shorter timeout MUST NOT be paired with new synchronous long-running endpoints — async processing is what makes the shorter timeout safe. The change MUST be applied to `apps/api/src/main.ts` and MUST be documented in any developer-facing notes that reference the old 10-minute value.

**Phase 1 exception:** The document generation endpoint (`POST /cases/:id/generate`) is a pre-existing synchronous long-running endpoint that predates the 30s timeout rule. To accommodate its worst-case AI retry budget (~150s), `requestTimeout` SHALL be temporarily set to `300_000` ms (300s) during Phase 1. This exception MUST be documented with a `TODO(Phase2)` comment in `apps/api/src/main.ts` naming the `async-document-generation` change.

**Phase 2 reversion:** When `async-document-generation` is implemented and `POST /cases/:id/generate` returns `202 Accepted` immediately, `requestTimeout` SHALL revert to `30_000` ms. The Phase 1 exception and its `TODO(Phase2)` comment SHALL be removed.

(Previously: requestTimeout was unconditionally 30s with no documented exceptions.)

#### Scenario: Timeout is 30 seconds at startup under normal conditions

- GIVEN the API starts with the Phase 1 configuration
- WHEN the bootstrap configuration is logged or inspected
- THEN `requestTimeout` is 300 seconds
- AND a `TODO(Phase2)` comment names the async-document-generation change

#### Scenario: Slow synchronous request still aborts at 30s (non-generation endpoints)

- GIVEN an HTTP handler other than `/cases/:id/generate` does not respond within 30 seconds
- WHEN the timeout elapses
- THEN the server aborts the request
- AND the client receives a request-timeout response

#### Scenario: Generation endpoint survives retry budget (Phase 1)

- GIVEN the AI generation retries up to 3 times (~48s each)
- WHEN `POST /cases/:id/generate` is called
- THEN the server does not abort the request before retries complete (~150s worst case)

#### Scenario: Timeout reverts to 30s after Phase 2

- GIVEN Phase 2 `async-document-generation` is deployed
- WHEN the API server starts
- THEN `requestTimeout` is 30 seconds
- AND the `TODO(Phase2)` comment and 300s value are removed
