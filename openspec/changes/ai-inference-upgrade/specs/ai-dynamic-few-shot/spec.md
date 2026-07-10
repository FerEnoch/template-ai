# ai-dynamic-few-shot Specification

## Purpose

Inject a user's previously-reviewed entities as few-shot examples into extraction prompts. Each correction feeds future extractions, creating a feedback loop without model weight changes.

## Requirements

| # | Requirement | Strength | Summary |
|---|------------|----------|---------|
| R1 | Few-shot injection | MUST | 2–3 most-recent reviewed entities injected into extraction prompt |
| R2 | Feedback loop | MUST | User-reviewed/corrected entities surfaced in next extraction's few-shot block |
| R3 | Deterministic selection | SHALL | Most-recent N by `reviewedAt` timestamp |
| R4 | Context budget cap | MUST | Few-shot block respects `AI_MAX_TOKENS` — truncated if budget exceeded |
| R5 | Entity type filtering | SHOULD | Only inject entities with `reviewed: true` and `excluded: false` |
| R6 | Cross-document isolation | MUST | Few-shot drawn from user's templates/entities across documents |

### Requirement R1: Few-shot injection

The system MUST query the user's reviewed entities and inject 2–3 as formatted examples into the `{{fewShot}}` template variable.

#### Scenario: Reviewed entities appear in extraction prompt

- GIVEN user has reviewed 3 entities: `{ label: "Arrendatario", group: "PARTES", value: "Juan Pérez" }` with `reviewed: true`
- WHEN the next extraction prompt is rendered
- THEN the `{{fewShot}}` block contains those 3 entities formatted as examples

#### Scenario: No reviewed entities — empty few-shot block

- GIVEN user has zero reviewed entities
- WHEN the extraction prompt is rendered
- THEN `{{fewShot}}` is empty string (no injection, no error)

### Requirement R2: Feedback loop

When a user corrects an entity (edits `label`, `group`, or `value`) and marks it reviewed, the corrected entity SHALL appear in the next extraction's few-shot block.

#### Scenario: User correction feeds next extraction

- GIVEN entity "PRECIO" was extracted as group `INMUEBLE`, user corrects to group `MONTOS` and marks reviewed
- WHEN the next extraction runs for ANY document by the same user
- THEN the few-shot block includes the corrected `{ label: "PRECIO", group: "MONTOS" }` example

### Requirement R3: Deterministic selection

Selection SHALL be: `ORDER BY reviewedAt DESC LIMIT 3`. No semantic filtering, no vector search.

#### Scenario: Most-recent 3 selected

- GIVEN user has 10 reviewed entities across multiple extractions
- WHEN `FewShotProvider.getExamples()` is called
- THEN exactly 3 entities with the most recent `reviewedAt` are returned

### Requirement R4: Context budget cap

The total few-shot block (after formatting) MUST NOT exceed 25% of `AI_MAX_TOKENS` budget (estimated at 1 token ≈ 4 chars). If the block would exceed, it SHALL be truncated to 1 example with a truncation WARNING log.

#### Scenario: Few-shot block within budget

- GIVEN `AI_MAX_TOKENS=8192` and formatted few-shot block is ~800 chars (~200 tokens)
- WHEN prompt is assembled
- THEN all 3 examples are included

#### Scenario: Few-shot block exceeds budget — truncate with warning

- GIVEN formatted few-shot block would consume >2048 tokens
- WHEN budget check runs
- THEN only 1 example is included and a WARNING log is emitted

### Requirement R5: Entity type filtering

Only entities with `reviewed: true` AND `excluded: false` SHALL be candidates for few-shot injection.

#### Scenario: Excluded entity not injected

- GIVEN an entity has `reviewed: true` and `excluded: true`
- WHEN few-shot candidates are queried
- THEN the entity is excluded from results

### Requirement R6: Cross-document isolation

Few-shot examples SHALL be drawn from ALL documents the user has processed, not only the current document.

## Notes

- `FewShotProvider` lives in `apps/api/src/ai/few-shot-provider.ts`.
- No DB schema changes — uses existing `Entity.reviewed` and `Entity.reviewedAt` fields.
- The `reviewedAt` field MUST be added to the Entity schema (not currently in the contract; see shared-contracts delta).
