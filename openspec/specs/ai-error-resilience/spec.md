# ai-error-resilience Specification

## Purpose

Define the AI extraction pipeline's error handling contract: safe JSON parsing, structured error classification, retry semantics, and token budget management. Ensures AI failures (network, rate limit, malformed response) surface as typed errors with predictable retry behavior — not crashes or misclassification.

## Requirements

### Requirement: JSON parse safety

The system MUST wrap `JSON.parse` calls on AI responses in a `try/catch`. When parsing fails with a `SyntaxError`, the system MUST throw an `OpenRouterError` with code `INVALID_RESPONSE` and MUST NOT propagate the raw `SyntaxError`.

#### Scenario: Well-formed response parses cleanly

- GIVEN the AI returns a valid JSON object
- WHEN `OpenRouterService` parses the body
- THEN `JSON.parse` succeeds without throwing
- AND the parsed object is returned

#### Scenario: Malformed response throws typed error

- GIVEN the AI returns a truncated or non-JSON body
- WHEN `OpenRouterService` parses the body
- THEN the `SyntaxError` is caught
- AND an `OpenRouterError("INVALID_RESPONSE")` is thrown
- AND the original `SyntaxError` is attached as `cause`

### Requirement: Error classification

The system MUST classify AI failures as: `NETWORK_ERROR` (transport), `RATE_LIMIT` (HTTP 429), `INVALID_RESPONSE` (truncated JSON, Zod mismatch), and `CONFIG_ERROR` (HTTP 401/403, missing key, unsupported model). The system MUST NOT classify a `SyntaxError` as `NETWORK_ERROR`.

#### Scenario: SyntaxError maps to INVALID_RESPONSE

- GIVEN `JSON.parse` throws on a malformed response
- WHEN the error handler maps the exception
- THEN the code is `INVALID_RESPONSE` (not `NETWORK_ERROR`)

#### Scenario: Status codes map to typed codes

- GIVEN OpenRouter responds with HTTP 429, 401, or is unreachable
- WHEN the response handler inspects the response
- THEN 429 → `RATE_LIMIT`, 401 → `CONFIG_ERROR`, connection error → `NETWORK_ERROR`

### Requirement: Expanded retry policy

The system MUST retry AI calls classified as `RATE_LIMIT`, `NETWORK_ERROR`, or `INVALID_RESPONSE` up to 3 consecutive attempts. The system MUST NOT retry `CONFIG_ERROR`. After exhausting retries, `AnalysisResult.status` is set to `failed` with the last error message.

#### Scenario: Transient errors trigger retry

- GIVEN the first AI call returns `RATE_LIMIT`, `NETWORK_ERROR`, or `INVALID_RESPONSE`
- WHEN `DocumentAnalysisService` evaluates the error
- THEN the call is re-attempted (attempt 2 of 3)

#### Scenario: Config error does NOT retry

- GIVEN the AI call returns `CONFIG_ERROR` (HTTP 401)
- WHEN `DocumentAnalysisService` evaluates the error
- THEN no retry is attempted
- AND `AnalysisResult.status` is set to `failed` immediately

#### Scenario: Permanent failure after 3 retries

- GIVEN 3 consecutive failures with `INVALID_RESPONSE`
- WHEN the 3rd failure is caught
- THEN no 4th retry occurs
- AND `AnalysisResult.status` is `failed` with the last error message

### Requirement: Token budget management

The `maxTokens` configuration MUST be at least 8192 to prevent JSON truncation on large documents. The value MUST be configurable via the `AI_MAX_TOKENS` env var with a default of 8192. The configuration MUST be validated at API bootstrap.

#### Scenario: Default token budget is 8192

- GIVEN `AI_MAX_TOKENS` is not set
- WHEN `apps/api` reads the AI config
- THEN `maxTokens` resolves to 8192

#### Scenario: Custom budget via env var

- GIVEN `AI_MAX_TOKENS=16384` is set
- WHEN `apps/api` reads the AI config
- THEN `maxTokens` resolves to 16384

#### Scenario: Token budget below minimum rejected

- GIVEN `AI_MAX_TOKENS=4096` is explicitly set
- WHEN config is validated at bootstrap
- THEN startup fails with an error indicating the 8192 minimum
