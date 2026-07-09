# Delta for shared-contracts

> All existing schemas (Document, Entity, AnalysisResult, Template, ClassifySpanRequest/Response) are **unchanged**. `MANUAL_ENTITY_LIMIT` is **unchanged**. This delta adds Case-related schemas only.

## ADDED Requirements

### Requirement: CaseStatus enum

The contracts package MUST export `CaseStatus` as a Zod enum: `borrador | generado | exportado | archivado`.

#### Scenario: Valid status passes
- **Given** the value "borrador"
- **When** parsed by `CaseStatus`
- **Then** validation succeeds

#### Scenario: Invalid status rejected
- **Given** the value "invalid_status"
- **When** parsed by `CaseStatus`
- **Then** validation fails

### Requirement: CaseSchema

The system MUST define `CaseSchema` with: `id` (uuid), `userId` (bigint), `templateId` (uuid), `status` (CaseStatus, default `borrador`), `formData` (Record<string,string>, default `{}`), `generatedText` (string, nullable), `createdAt` (ISO datetime), `updatedAt` (ISO datetime).

#### Scenario: Valid case
- **Given** all required fields including formData and timestamps
- **When** parsed by `CaseSchema`
- **Then** validation succeeds

#### Scenario: generatedText is nullable
- **Given** a case without `generatedText`
- **When** parsed by `CaseSchema`
- **Then** validation succeeds with `generatedText: null`

### Requirement: CreateCaseRequestSchema

The system MUST define `CreateCaseRequestSchema` with `{ templateId: uuid }`.

#### Scenario: Valid create request
- **Given** `{ templateId: "550e8400-e29b-41d4-a716-446655440000" }`
- **When** parsed by `CreateCaseRequestSchema`
- **Then** validation succeeds

### Requirement: UpdateCaseFormDataSchema

The system MUST define `UpdateCaseFormDataSchema` with `formData` (Record<string,string>). The schema MAY also accept `status` for archiving.

#### Scenario: Valid form data update
- **Given** `{ formData: { "ent_1": "Juan Pérez" } }`
- **When** parsed by `UpdateCaseFormDataSchema`
- **Then** validation succeeds

### Requirement: GenerateDocumentResponseSchema

The system MUST define `GenerateDocumentResponseSchema` with `{ generatedText: non-empty string }`.

#### Scenario: Valid response
- **Given** `{ generatedText: "Full legal document..." }`
- **When** parsed by `GenerateDocumentResponseSchema`
- **Then** validation succeeds

#### Scenario: Empty text rejected
- **Given** `{ generatedText: "" }`
- **When** parsed by `GenerateDocumentResponseSchema`
- **Then** validation fails

### Requirement: ExportRequestSchema

The system MUST define `ExportRequestSchema` with `{ format: 'pdf' | 'docx' }`.

#### Scenario: Valid export request
- **Given** `{ format: "pdf" }`
- **When** parsed by `ExportRequestSchema`
- **Then** validation succeeds
