# Delta for ai-error-resilience

## ADDED Requirements

### Requirement: Router config validation at bootstrap

When `AI_MODEL_ROUTER_ENABLED=true`, the system MUST validate at API bootstrap that `AI_MODEL` is non-empty. SHALL NOT reject startup for missing per-task router vars — only log WARNING. This extends the existing token-budget validation.

#### Scenario: Router enabled but AI_MODEL missing — startup fails

- GIVEN `AI_MODEL_ROUTER_ENABLED=true` and `AI_MODEL` is unset or empty
- WHEN `apps/api` bootstraps the AI config
- THEN startup fails with error: "AI_MODEL_ROUTER_ENABLED=true requires AI_MODEL to be set"

#### Scenario: Router enabled, AI_MODEL set — startup succeeds with warnings for missing per-task vars

- GIVEN `AI_MODEL_ROUTER_ENABLED=true`, `AI_MODEL=openai/gpt-4o-mini`, per-task vars unset
- WHEN bootstrap validates
- THEN startup succeeds AND WARNING logs emitted for each missing per-task env var

#### Scenario: Router disabled — no router validation runs

- GIVEN `AI_MODEL_ROUTER_ENABLED=false`
- WHEN bootstrap runs
- THEN router env vars are NOT validated
- AND existing token-budget validation still runs

### Requirement: Per-task model fallback

When a per-task model call fails with a retryable error (`NETWORK_ERROR`, `RATE_LIMIT`, `INVALID_RESPONSE`), the system SHALL retry per the existing 3-attempt retry policy. After exhausting per-task-model retries, the system SHOULD attempt one additional retry via the fallback chain (`AI_MODEL_FALLBACK` → `AI_MODEL`).

#### Scenario: Extraction model exhausted — fallback retry

- GIVEN `AI_MODEL_EXTRACTION=openai/gpt-4o` fails 3 times with `RATE_LIMIT`
- WHEN retries are exhausted
- THEN one fallback attempt is made with `AI_MODEL_FALLBACK` (or `AI_MODEL` if unset)
- AND a WARNING log records the fallback reason

#### Scenario: Fallback model also fails — permanent failure

- GIVEN both per-task model and fallback model fail
- WHEN all retries AND fallback attempt fail
- THEN `AnalysisResult.status` is `failed` with aggregated error message

#### Scenario: CONFIG_ERROR on per-task model — no fallback retry

- GIVEN per-task model returns `CONFIG_ERROR` (HTTP 401)
- WHEN the error is classified
- THEN no fallback retry is attempted
- AND `AnalysisResult.status` is `failed` immediately

## MODIFIED Requirements

### Requirement: Expanded retry policy

The system MUST retry AI calls classified as `RATE_LIMIT`, `NETWORK_ERROR`, or `INVALID_RESPONSE` up to 3 consecutive attempts per model in the resolution chain (per-task model, then fallback). The system MUST NOT retry `CONFIG_ERROR`. After exhausting all retries and fallback attempts, `AnalysisResult.status` is set to `failed` with the last error message.

(Previously: retry was a flat 3-attempt policy against a single model — no per-task or fallback awareness.)

#### Scenario: Transient errors trigger retry on per-task model

- GIVEN the first AI call to per-task model returns `RATE_LIMIT`, `NETWORK_ERROR`, or `INVALID_RESPONSE`
- WHEN `DocumentAnalysisService` evaluates the error
- THEN the call is re-attempted (attempt 2 of 3) on the same model

#### Scenario: Config error does NOT retry

- GIVEN the AI call returns `CONFIG_ERROR` (HTTP 401)
- WHEN `DocumentAnalysisService` evaluates the error
- THEN no retry is attempted
- AND `AnalysisResult.status` is set to `failed` immediately

#### Scenario: Permanent failure after exhausting model + fallback

- GIVEN 3 consecutive failures with `INVALID_RESPONSE` on per-task model AND 1 failure on fallback model
- WHEN all attempts are exhausted
- THEN no further retries occur
- AND `AnalysisResult.status` is `failed` with aggregated error message
