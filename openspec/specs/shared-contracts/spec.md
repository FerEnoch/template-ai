# shared-contracts Specification

## Purpose

Define Zod schemas as the single source of truth for domain types shared between the frontend and future backend. Pure types package with no runtime dependencies.

## Requirements

### Requirement: Contract package structure

The system MUST provide `packages/contracts` as a pnpm workspace package. The package MUST export Zod schemas and inferred TypeScript types. The package MUST NOT have runtime dependencies beyond Zod.

#### Scenario: Package is importable from web app

- GIVEN `packages/contracts` exists in the workspace
- WHEN `apps/web` imports from `@template-ai/contracts`
- THEN the import resolves correctly and types are available

#### Scenario: No runtime deps except Zod

- GIVEN the contracts package
- WHEN `package.json` dependencies are reviewed
- THEN only `zod` appears as a dependency

### Requirement: Document schema

The system MUST define a `Document` schema with fields: `id` (uuid string), `filename` (non-empty string), `mimeType` (enum: PDF, DOCX, JPG), `sizeBytes` (positive integer, max 25MB), `status` (enum: pending, uploading, uploaded, failed), `uploadedAt` (ISO datetime string), `filePath` (string, path to persisted file on disk, nullable for backward compatibility).

#### Scenario: Valid document passes validation

- GIVEN a document object `{ id, filename, mimeType: "PDF", sizeBytes: 1048576, status: "uploaded", uploadedAt }`
- WHEN parsed by the Document schema
- THEN validation succeeds and the inferred type is correct

#### Scenario: Oversized document rejected

- GIVEN a document with `sizeBytes: 30_000_000`
- WHEN parsed by the Document schema
- THEN validation fails with a size constraint error

#### Scenario: Valid document with filePath passes validation

- GIVEN a document object with all existing fields plus `filePath: "/uploads/abc123-report.pdf"`
- WHEN parsed by the Document schema
- THEN validation succeeds and `filePath` is accessible on the inferred type

#### Scenario: Document without filePath still valid (backward compat)

- GIVEN a legacy document object without `filePath`
- WHEN parsed by the Document schema
- THEN validation succeeds (filePath is optional/nullable)

### Requirement: Entity schema

The system MUST define an `Entity` schema with fields: `id` (uuid string), `label` (non-empty string), `value` (string), `group` (non-empty string), `confidence` (enum: alta, media, baja), `sourceSpan` (object with `start` and `end` positive integers, **optional/nullable** — an entity whose value cannot be located in the extracted text is still valid, just not highlightable), `reviewed` (boolean, default false), `excluded` (boolean, default false).

(Previously: `sourceSpan` was required — analysis responses with no exact match failed validation. The `excluded` field did not exist.)

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

#### Scenario: Excluded field defaults to false

- GIVEN an entity without an `excluded` field
- WHEN parsed by the Entity schema
- THEN validation succeeds with `excluded: false`

#### Scenario: Excluded entity validates

- GIVEN an entity with `excluded: true`
- WHEN parsed by the Entity schema
- THEN validation succeeds

### Requirement: AnalysisResult schema

The system MUST define an `AnalysisResult` schema with fields: `documentId` (uuid string), `status` (enum: pending, processing, analyzing, completed, failed), `entities` (array of Entity), `progress` (integer 0–100), `startedAt` (ISO datetime), `completedAt` (ISO datetime, nullable), `extractedText` (string, optional/nullable — the full document text from OCR/parsing, consumed by the review step to render highlights).

(Previously: AnalysisResult carried entities and progress only — extracted text was not part of the contract)

#### Scenario: Completed analysis with entities

- GIVEN an analysis result with status "completed" and 8 entities
- WHEN parsed by the AnalysisResult schema
- THEN validation succeeds and entities array is accessible

#### Scenario: Analyzing status validates

- GIVEN an analysis result with `status: "analyzing"` (mid AI phase)
- WHEN parsed by the AnalysisResult schema
- THEN validation succeeds
- AND the inferred TypeScript type narrows `status` to include "analyzing" as a valid value

#### Scenario: Result with extractedText validates

- GIVEN an analysis result with status "completed" and a non-empty `extractedText`
- WHEN parsed by the AnalysisResult schema
- THEN validation succeeds and `extractedText` is accessible

#### Scenario: Result without extractedText validates (backward compat)

- GIVEN an analysis result that omits `extractedText`
- WHEN parsed by the AnalysisResult schema
- THEN validation succeeds (the field is optional)

### Requirement: Template schema

The system MUST define a `Template` schema with fields: `id` (uuid string), `name` (non-empty string, max 200 chars), `description` (string, max 1000 chars, optional), `documentId` (uuid string), `entities` (array of Entity), `category` (non-empty string), `createdAt` (ISO datetime), `status` (enum: draft, saved).

#### Scenario: Valid template passes validation

- GIVEN a template with name, documentId, and entities
- WHEN parsed by the Template schema
- THEN validation succeeds

#### Scenario: Empty name rejected

- GIVEN a template with `name: ""`
- WHEN parsed by the Template schema
- THEN validation fails with a min-length error

### Requirement: Schema exports

The package MUST export each schema as a named export. The package MUST also export inferred TypeScript types (`Document`, `Entity`, `AnalysisResult`, `Template`) using `z.infer`. The package MUST provide a barrel `index.ts` re-exporting everything.

#### Scenario: Type inference works

- GIVEN the contracts package is imported
- WHEN a variable is typed as `Document` (inferred type)
- THEN TypeScript enforces the schema shape at compile time

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
