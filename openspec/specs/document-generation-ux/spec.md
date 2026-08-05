# document-generation-ux Specification

## Purpose

Latency-aware generation waiting UI and frontend error mapping for the synchronous document generation flow. Covers 502/500 fallback messages, HTML-body-tolerant error parsing, spinner UX with time expectation, catch-recovery that re-checks case status after proxy failures, and backend timeout accommodation. **Phase 1 only.**

## Requirements

| # | Requirement | Summary |
|---|------------|---------|
| R1 | Generation spinner with time expectation | Static message: "Generando documento... Esto puede tomar hasta 2 minutos." |
| R2 | Latency-aware 502/500 fallback messages | Spanish messages acknowledging proxy drop (502) and server load (500) |
| R3 | HTML/plain-text tolerant error parsing | Tolerate non-JSON bodies; fall back to status-based message for 5xx |
| R4 | Catch recovery via case status re-check | On fetch error, re-fetch case; if `generado` redirect to preview |
| R5 | Latency-context error UI | CaseStickyBar renders error prop as-is (already latency-aware) |
| R6 | Backend requestTimeout accommodation | 300s to cover worst-case retry budget |
| R7 | Next.js proxyTimeout accommodation | 300s in next.config.ts |

### Requirement: Generation spinner with time expectation

The system MUST display "Generando documento... Esto puede tomar hasta 2 minutos." below a spinning Loader2 while `status === "generating"` in CaseStickyBar.

#### Scenario: Spinner and message render during generation

- GIVEN the user clicks "Generar documento"
- WHEN status transitions to "generating"
- THEN CaseStickyBar shows a Loader2 spin animation and the 2-minute expectation message

#### Scenario: Spinner clears on generation success

- GIVEN generation is in progress
- WHEN the API returns a successful Case response
- THEN the user is redirected to `/preview/[id]` and the spinner unmounts

### Requirement: Latency-aware 502 and 500 fallback messages

`fallbackMessageForStatus` MUST return Spanish messages for `502` and `500` that distinguish proxy drops from server errors and avoid the generic "error inesperado" default.

#### Scenario: 502 returns proxy-timeout message

- GIVEN a response with status 502 and unparseable body
- WHEN `fallbackMessageForStatus(502)` is called
- THEN a latency-aware message (not "error inesperado") is returned about the connection dropping mid-generation

#### Scenario: 500 returns server-load message

- GIVEN a response with status 500
- WHEN `fallbackMessageForStatus(500)` is called
- THEN a message acknowledging server processing load is returned

### Requirement: HTML/plain-text tolerant error parsing

`parseErrorResponse` in `apps/web/src/lib/api/cases.ts` MUST handle non-JSON response bodies. When the body is HTML or plain text and status >= 500, it SHALL fall back to `fallbackMessageForStatus` without throwing.

#### Scenario: HTML 502 body falls back gracefully

- GIVEN a response with Content-Type "text/html", status 502, and body `<html>...502 Bad Gateway...</html>`
- WHEN `parseErrorResponse` is called
- THEN JSON.parse fails silently and the 502 fallback message is returned

#### Scenario: Empty body falls back

- GIVEN a response with status 500 and an empty body
- WHEN `parseErrorResponse` is called
- THEN the body-trim check short-circuits and the 500 fallback message is returned

### Requirement: Catch recovery via case status re-check

The `handleGenerate` catch block MUST re-fetch the case via `fetchCase(state.caseId)`. If status is `generado`, treat as success and redirect to `/preview/[id]`. If `archivado`, redirect to `/biblioteca`. Only surface an error when neither status is confirmed.

#### Scenario: Proxy 502 after backend success → recovered

- GIVEN the backend completed generation (status: "generado")
- WHEN the proxy drops the connection with a 502 HTML page
- THEN `handleGenerate` catch calls `fetchCase`
- AND since status is "generado", redirects to `/preview/[id]` without error

#### Scenario: Genuine backend failure stays as error

- GIVEN the backend failed and case status remains "borrador"
- WHEN `handleGenerate` catch calls `fetchCase` and status is not "generado"
- THEN the error is surfaced via `setGenerationError` with the latency-aware message

### Requirement: Latency-context error UI

CaseStickyBar, when displaying an error from the `error` prop, MUST render the message verbatim — it already contains latency-aware copy from prior parsing. The UI SHALL NOT further wrap or replace it.

#### Scenario: Error renders latency-aware message

- GIVEN `generationError` is set to the 502 fallback message
- WHEN CaseStickyBar renders with `error` prop
- THEN AlertCircle and the full latency-aware message appear
- AND the message is not truncated or replaced with "error inesperado"

### Requirement: Backend requestTimeout accommodation

The NestJS server MUST set `server.requestTimeout` to `300_000` ms in `apps/api/src/main.ts`. `server.timeout` SHALL remain `0`. This 300s value covers the worst-case AI retry budget (~150s) and is a **Phase 1 accommodation** — Phase 2 reverts to 30s.

#### Scenario: Timeout survives 3-retry worst case

- GIVEN AI generation retries up to 3 times (~48s each)
- WHEN the `/cases/:id/generate` endpoint is called
- THEN the server does not destroy the socket before retries complete

### Requirement: Next.js proxyTimeout accommodation

`next.config.ts` MUST set `experimental.proxyTimeout: 300_000` so the dev rewrite proxy does not drop connections during long generation calls.

#### Scenario: Proxy stays alive during generation

- GIVEN the API endpoint takes 48–150s
- WHEN the Next.js proxy forwards `/api/cases/:id/generate`
- THEN the proxy connection is not terminated before the API responds
