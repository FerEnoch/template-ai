# Delta for document-generation

## MODIFIED Requirements

### Requirement: R5 — Error Resilience

The system MUST retry on `RATE_LIMIT` and `NETWORK_ERROR` (3 attempts). On `INVALID_RESPONSE` or timeout, MUST return 422. On OpenRouter unavailability, MUST return 502. Error messages in the response body MUST be in Spanish. The response body MUST include `errorType` (e.g. `"NETWORK_ERROR"`, `"INVALID_RESPONSE"`, `"RATE_LIMIT"`).
(Previously: Error resilience without Spanish localization or errorType field in response.)

#### Scenario: OpenRouter timeout after retries

- GIVEN OpenRouter does not respond within the timeout
- AFTER exhausting 3 retry attempts
- THEN a 422 error is returned and case remains `borrador`

#### Scenario: OpenRouter unavailable

- GIVEN OpenRouter returns NETWORK_ERROR on all retries
- WHEN the retry limit is reached
- THEN a 502 error is returned with Spanish message and `errorType: "NETWORK_ERROR"`

#### Scenario: INVALID_RESPONSE returns Spanish error

- GIVEN OpenRouter returns malformed JSON on all retries
- WHEN the retry limit is reached
- THEN a 422 error is returned with Spanish message and `errorType: "INVALID_RESPONSE"`

## ADDED Requirements

### Requirement: R7 — Structured Error Logging

The system MUST call `logger.error()` with the full error stack in `DocumentGenerationService.generate()` catch block. `OpenRouterService.generateDocument()` MUST log HTTP status and response body fragment (≤200 chars) before throwing `OpenRouterError`. Log entries MUST NOT contain user form data or PII.

#### Scenario: Exception caught with diagnostic log

- GIVEN OpenRouter throws an OpenRouterError during generation
- WHEN the catch block in `DocumentGenerationService.generate()` handles it
- THEN `logger.error` is called with the full error stack
- AND the original error details are preserved in logs

#### Scenario: OpenRouter error logged before throw

- GIVEN OpenRouter returns a non-200 HTTP status
- WHEN `generateDocument()` constructs an OpenRouterError
- THEN status code and response body fragment (≤200 chars) are logged at error level
- AND user form data is excluded from the log entry
