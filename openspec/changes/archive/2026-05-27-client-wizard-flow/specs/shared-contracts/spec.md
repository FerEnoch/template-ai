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

The system MUST define a `Document` schema with fields: `id` (uuid string), `filename` (non-empty string), `mimeType` (enum: PDF, DOCX, JPG), `sizeBytes` (positive integer, max 25MB), `status` (enum: pending, uploading, uploaded, failed), `uploadedAt` (ISO datetime string).

#### Scenario: Valid document passes validation

- GIVEN a document object `{ id, filename, mimeType: "PDF", sizeBytes: 1048576, status: "uploaded", uploadedAt }`
- WHEN parsed by the Document schema
- THEN validation succeeds and the inferred type is correct

#### Scenario: Oversized document rejected

- GIVEN a document with `sizeBytes: 30_000_000`
- WHEN parsed by the Document schema
- THEN validation fails with a size constraint error

### Requirement: Entity schema

The system MUST define an `Entity` schema with fields: `id` (uuid string), `label` (non-empty string), `value` (string), `group` (non-empty string), `confidence` (enum: alta, media, baja), `sourceSpan` (object with `start` and `end` positive integers), `reviewed` (boolean, default false).

#### Scenario: Valid entity passes validation

- GIVEN an entity with all required fields and confidence "alta"
- WHEN parsed by the Entity schema
- THEN validation succeeds

#### Scenario: Missing required field rejected

- GIVEN an entity without a `label`
- WHEN parsed by the Entity schema
- THEN validation fails

### Requirement: AnalysisResult schema

The system MUST define an `AnalysisResult` schema with fields: `documentId` (uuid string), `status` (enum: pending, processing, completed, failed), `entities` (array of Entity), `progress` (integer 0–100), `startedAt` (ISO datetime), `completedAt` (ISO datetime, nullable).

#### Scenario: Completed analysis with entities

- GIVEN an analysis result with status "completed" and 8 entities
- WHEN parsed by the AnalysisResult schema
- THEN validation succeeds and entities array is accessible

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
