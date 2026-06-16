# Delta for shared-contracts

## MODIFIED Requirements

### Requirement: Entity schema

The system MUST define an `Entity` schema with fields: `id` (uuid string), `label` (non-empty string), `value` (string), `group` (non-empty string), `confidence` (enum: alta, media, baja), `sourceSpan` (object with `start` and `end` positive integers, **optional/nullable** — an entity whose value cannot be located in the extracted text is still valid, just not highlightable), `reviewed` (boolean, default false).

(Previously: `sourceSpan` was required — analysis responses with no exact match failed validation)

#### Scenario: Valid entity passes validation

- GIVEN an entity with all required fields and confidence "alta"
- WHEN parsed by the Entity schema
- THEN validation succeeds

#### Scenario: Missing required field rejected

- GIVEN an entity without a `label`
- WHEN parsed by the Entity schema
- THEN validation fails

#### Scenario: Entity without sourceSpan validates

- GIVEN an entity whose `sourceSpan` is `undefined` (post-validation fallback)
- WHEN parsed by the Entity schema
- THEN validation succeeds and the entity remains usable in the UI

### Requirement: AnalysisResult schema

The system MUST define an `AnalysisResult` schema with fields: `documentId` (uuid string), `status` (enum: pending, processing, analyzing, completed, failed), `entities` (array of Entity), `progress` (integer 0–100), `startedAt` (ISO datetime), `completedAt` (ISO datetime, nullable), `extractedText` (string, optional/nullable — the full document text from OCR/parsing, consumed by the review step to render highlights).

(Previously: AnalysisResult carried entities and progress only — extracted text was not part of the contract)

#### Scenario: Completed analysis with entities

- GIVEN an analysis result with status "completed" and 8 entities
- WHEN parsed by the AnalysisResult schema
- THEN validation succeeds and entities array is accessible

#### Scenario: Analyzing status validates

- GIVEN an analysis result with `status: "analyzing"`
- WHEN parsed by the AnalysisResult schema
- THEN validation succeeds
- AND the inferred TypeScript type includes "analyzing" as a valid status

#### Scenario: Result with extractedText validates

- GIVEN an analysis result with status "completed" and a non-empty `extractedText`
- WHEN parsed by the AnalysisResult schema
- THEN validation succeeds and `extractedText` is accessible

#### Scenario: Result without extractedText validates (backward compat)

- GIVEN an analysis result that omits `extractedText`
- WHEN parsed by the AnalysisResult schema
- THEN validation succeeds (the field is optional)

## ADDED Requirements

### Requirement: sourceSpan post-validation

The analysis service MUST post-validate every AI-emitted `sourceSpan` against the actual `extractedText` before returning the result. For each entity, the service MUST search `extractedText` for the exact `entity.value` (case-sensitive). If exactly one match is found, the service MUST replace the AI's approximate `sourceSpan` with `{ start: indexOf(value), end: indexOf(value) + value.length }`. If multiple matches exist, the service SHOULD pick the match whose `start` is closest to the AI's approximate `aiSpan.start`. If no match is found, the service SHOULD set `sourceSpan` to `undefined` rather than emit a misleading offset. Validation MUST be case-sensitive initially; case-insensitive matching MAY be added later as an enhancement.

#### Scenario: Exact match replaces approximate offset

- GIVEN `extractedText` contains "Juan Pérez" exactly once and the AI emitted `sourceSpan: { start: 100, end: 110 }`
- WHEN post-validation runs
- THEN the entity's `sourceSpan` is replaced with the real position of "Juan Pérez"

#### Scenario: Multiple matches disambiguated by AI offset

- GIVEN "Lima" appears at positions 50, 220, 500 and the AI emitted `sourceSpan: { start: 500, end: 504 }`
- WHEN post-validation runs
- THEN the match closest to offset 500 is selected (the third occurrence)

#### Scenario: No match sets sourceSpan to undefined

- GIVEN `extractedText` does not contain `entity.value` (OCR drift, encoding mismatch)
- WHEN post-validation runs
- THEN `sourceSpan` is `undefined`
- AND the entity is still present in the result and remains editable

#### Scenario: Case-sensitive validation

- GIVEN `extractedText` contains "juan pérez" (lowercase) and `entity.value` is "Juan Pérez" (mixed case)
- WHEN post-validation runs
- THEN no match is found and `sourceSpan` is `undefined`
- AND case-insensitive matching is NOT applied
