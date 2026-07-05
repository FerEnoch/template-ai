# Delta for client-wizard-flow

## ADDED Requirements

### Requirement: Bootstrap idempotency

The bootstrap `useEffect` in `/nuevo/[templateId]` that calls `createCase(templateId)` MUST use an `AbortController` to cancel in-flight POST requests on re-mount or unmount. The effect MUST also guard with a `useRef<boolean>` in-flight flag to short-circuit re-entrant calls BEFORE issuing a request. On React Fast Refresh or StrictMode double-mount, only ONE `POST /api/cases` MUST reach the server.

#### Scenario: Double-mount triggers one POST

- GIVEN the `/nuevo/[templateId]` page mounts
- WHEN React StrictMode triggers a double-mount in development
- THEN only one `POST /api/cases` request is sent
- AND the in-flight `useRef` guard prevents the second call

#### Scenario: Unmount aborts in-flight createCase

- GIVEN a `createCase` POST is in-flight
- WHEN the component unmounts (navigation away)
- THEN the AbortController aborts the request
- AND no orphan case row is created by the stale request

#### Scenario: Fast Refresh does not duplicate

- GIVEN `/nuevo/[templateId]` is rendered with an existing case
- WHEN a code edit triggers Fast Refresh
- THEN the effect short-circuits via the in-flight guard
- AND no second `POST /api/cases` is issued

### Requirement: Generate handler re-entry guard

`handleGenerate` and `handleRegenerate` MUST guard against double-click with a `useRef<boolean>` in-flight flag. The guard MUST be checked BEFORE any async work begins. The flag MUST be reset on completion OR error. The `disabled` prop on the button MUST NOT be the only defense — it is async and a fast second click can slip through before React commits the disabled state.

#### Scenario: Double-click fires generate once

- GIVEN the Generar button is enabled
- WHEN the user clicks it twice in under 100ms
- THEN only one `generateCase()` call is initiated
- AND the in-flight guard blocks the second invocation

#### Scenario: Guard resets after error

- GIVEN `generateCase` throws an error
- WHEN the error is caught
- THEN the in-flight guard is reset
- AND the user MAY retry

#### Scenario: Regenerate uses same guard

- GIVEN a case is in `generado` state with Regenerar button visible
- WHEN the user fast-clicks Regenerar twice
- THEN only one `generateCase()` call is initiated
