# Delta for shared-contracts

## ADDED Requirements

### Requirement: ClassifySpanRequest schema

The system MUST define a `ClassifySpanRequest` Zod schema with fields: `text` (non-empty string — selected span), `sourceSpan` (object with `start` and `end` positive integers), `context` (string — ±100 characters surrounding the span). The schema MUST be exported from `@template-ai/contracts`.

#### Scenario: Valid request passes validation

- GIVEN `{ text: "Juan Pérez", sourceSpan: { start: 50, end: 62 }, context: "...Ante mí compareció Juan Pérez, mayor de edad..." }`
- WHEN parsed by `ClassifySpanRequest`
- THEN validation succeeds

#### Scenario: Missing text rejected

- GIVEN `{ text: "", sourceSpan: { start: 0, end: 0 }, context: "" }`
- WHEN parsed by `ClassifySpanRequest`
- THEN validation fails with a non-empty constraint error

### Requirement: ClassifySpanResponse schema

The system MUST define a `ClassifySpanResponse` Zod schema with fields: `label` (non-empty string), `group` (non-empty string), `value` (string — mirrors the input text). The schema MUST be exported from `@template-ai/contracts`.

#### Scenario: Valid response passes validation

- GIVEN `{ label: "Arrendatario", group: "PARTES", value: "Juan Pérez" }`
- WHEN parsed by `ClassifySpanResponse`
- THEN validation succeeds

### Requirement: Manual entity limit constant

The contracts package MUST export `MANUAL_ENTITY_LIMIT = 5` as a constant. Both frontend and backend MUST reference this constant.

#### Scenario: Constant is importable

- GIVEN `@template-ai/contracts` is installed
- WHEN `MANUAL_ENTITY_LIMIT` is imported
- THEN the value is `5`

## Notes

- `EntitySchema` requires **no changes** — manual entities use the identical shape with `sourceSpan` populated from text selection and `confidence` set to ALTA.
- `AnalysisResultSchema` requires **no changes** — `entities` array already accepts any valid Entity.
- `userCreated` boolean on Entity is **not required** for MVP; distinction can be inferred from entity origin context rather than schema field.
