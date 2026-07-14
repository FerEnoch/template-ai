# ai-model-router Specification

## Purpose

Route AI calls to task-specific models in production via per-task environment variables with a universal fallback chain. Gated by a feature flag; dev/test remain single-model.

## Requirements

| # | Requirement | Strength | Summary |
|---|------------|----------|---------|
| R1 | Feature gate | MUST | Router active only when `AI_MODEL_ROUTER_ENABLED=true` |
| R2 | Per-task resolution | MUST | Three tasks: extraction (`AI_MODEL_EXTRACTION`), classification (`AI_MODEL_CLASSIFICATION`), generation (`AI_MODEL_GENERATION`) |
| R3 | Universal fallback chain | MUST | Task env → `AI_MODEL_FALLBACK` → `AI_MODEL` |
| R4 | Bootstrap validation | MUST | Fail fast when router enabled and required vars missing |
| R5 | Dev/test single-model | SHALL | When `AI_MODEL_ROUTER_ENABLED=false`, all calls use `AI_MODEL` |
| R6 | Resolution trace logging | SHALL | Log resolved model per call at info level |
| R7 | Optional FALLBACK | SHOULD | `AI_MODEL_FALLBACK` is optional; if unset and router enabled, log WARNING and degrade to `AI_MODEL` |

### Requirement R1: Feature gate

The system MUST read `AI_MODEL_ROUTER_ENABLED` (boolean, default `false`). When `false`, the router is bypassed entirely.

#### Scenario: Router disabled — single model

- GIVEN `AI_MODEL_ROUTER_ENABLED=false`
- WHEN any AI call is made
- THEN `AI_MODEL` is used for all tasks

### Requirement R2: Per-task resolution

When enabled, extraction SHALL use `AI_MODEL_EXTRACTION`, classification SHALL use `AI_MODEL_CLASSIFICATION`, generation SHALL use `AI_MODEL_GENERATION`.

#### Scenario: Extraction uses its own model

- GIVEN `AI_MODEL_ROUTER_ENABLED=true` and `AI_MODEL_EXTRACTION=openai/gpt-4o`
- WHEN `DocumentAnalysisService` calls for entity extraction
- THEN the model resolved is `openai/gpt-4o`

### Requirement R3: Universal fallback chain

Resolution order: per-task env → `AI_MODEL_FALLBACK` → `AI_MODEL`. Each fallback MUST log at WARNING level.

#### Scenario: Per-task var unset, fallback to AI_MODEL_FALLBACK

- GIVEN `AI_MODEL_EXTRACTION` is unset, `AI_MODEL_FALLBACK=anthropic/claude-3-haiku`
- WHEN an extraction call resolves
- THEN the model is `anthropic/claude-3-haiku`

#### Scenario: Neither task var nor FALLBACK set — falls to AI_MODEL

- GIVEN `AI_MODEL_EXTRACTION` and `AI_MODEL_FALLBACK` are both unset
- WHEN an extraction call resolves
- THEN the model is `AI_MODEL` with a WARNING log

### Requirement R4: Bootstrap validation

At API startup, when `AI_MODEL_ROUTER_ENABLED=true`, the system MUST validate that `AI_MODEL` is set (non-empty). SHALL NOT reject startup if per-task vars are absent — only log WARNING.

#### Scenario: Router enabled but AI_MODEL missing — startup fails

- GIVEN `AI_MODEL_ROUTER_ENABLED=true` and `AI_MODEL` is unset or empty
- WHEN `apps/api` bootstraps
- THEN startup fails with a clear error message

#### Scenario: Router enabled, AI_MODEL set, per-task vars absent — starts with warnings

- GIVEN `AI_MODEL_ROUTER_ENABLED=true`, `AI_MODEL=openai/gpt-4o-mini`, per-task vars unset
- WHEN bootstrap runs
- THEN startup succeeds with WARNING log per missing task var

### Requirement R5: Dev/test single-model

When `AI_MODEL_ROUTER_ENABLED=false`, the router MUST NOT read any router env vars, keeping dev/test deterministic.

#### Scenario: Dev mode ignores router vars

- GIVEN `AI_MODEL_ROUTER_ENABLED=false` but `AI_MODEL_EXTRACTION=openai/gpt-4o`
- WHEN an extraction call resolves
- THEN `AI_MODEL` is used — `AI_MODEL_EXTRACTION` is ignored

### Requirement R7: Optional FALLBACK

`AI_MODEL_FALLBACK` is an optional env var. If router is enabled and it is unset, log a WARNING and fall through to `AI_MODEL`.

#### Scenario: Router enabled, FALLBACK unset — degrade with warning

- GIVEN `AI_MODEL_ROUTER_ENABLED=true`, `AI_MODEL_FALLBACK` unset
- WHEN resolution falls through per-task var
- THEN a WARNING log is emitted and `AI_MODEL` is used

## Notes

- Model resolution is per-call, not cached, to allow runtime reconfiguration.
- Resolution logic lives in `apps/api/src/ai/model-router.ts` exporting `resolveModel(task: AiTask): string`.
- `AiTask` is a union type: `"extraction" | "classification" | "generation"`.
