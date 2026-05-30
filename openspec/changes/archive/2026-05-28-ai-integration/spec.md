# Delta Spec: ai-integration

## ADDED Requirements — File Persistence

### Requirement: Disk Storage for Uploaded Documents

The system MUST persist uploaded document files to local disk via Multer `diskStorage` instead of discarding them after processing. The storage destination MUST be configurable via `UPLOAD_DIR` environment variable with a default of `./uploads`. Files MUST be stored with their original filename plus a UUID prefix to prevent collisions.

#### Scenario: File saved to disk on upload
- **GIVEN** a valid PDF file upload request
- **WHEN** the documents controller processes the upload
- **THEN** the file is written to `UPLOAD_DIR/{uuid}-{originalFilename}`
- **AND** the file path is stored in the document record

#### Scenario: Upload directory does not exist
- **GIVEN** `UPLOAD_DIR` points to a non-existent directory
- **WHEN** the API starts or first upload is attempted
- **THEN** the system creates the directory automatically
- **AND** the upload proceeds normally

### Requirement: File Size Enforcement

The system MUST enforce a maximum upload size of 25 MB at the Multer middleware level. Requests exceeding this limit MUST be rejected with a 413 status before file processing begins.

#### Scenario: File within size limit accepted
- **GIVEN** a PDF file of 10 MB
- **WHEN** uploaded via `POST /api/documents/upload`
- **THEN** the file is accepted and persisted to disk

#### Scenario: Oversized file rejected
- **GIVEN** a file of 30 MB
- **WHEN** uploaded via `POST /api/documents/upload`
- **THEN** the request is rejected with HTTP 413
- **AND** no file is written to disk

---

## ADDED Requirements — AI Entity Extraction

### Requirement: Real AI Entity Extraction via OpenRouter

The system MUST replace hardcoded `SAMPLE_ENTITIES` with real AI-powered entity extraction using the OpenRouter SDK. The system MUST send a Spanish-language system prompt with few-shot examples to the configured model. The system MUST validate the AI response against the `Entity` Zod schema from `@template-ai/contracts`.

#### Scenario: AI extracts entities from uploaded document
- **GIVEN** a document with `status: "uploaded"` and a valid `filePath`
- **WHEN** `AnalysisService` detects `progress === 100%` on first poll
- **THEN** `DocumentAnalysisService` reads the file, calls OpenRouter, and saves extracted entities
- **AND** the `AnalysisResult` status becomes `completed` with real entities

#### Scenario: AI response validated against Entity schema
- **GIVEN** the OpenRouter model returns a JSON array of entities
- **WHEN** `OpenRouterService` parses the response
- **THEN** each entity is validated against the `Entity` Zod schema
- **AND** entities with invalid structure are excluded from the result

---

## ADDED Requirements — AI Configuration

### Requirement: Environment-Driven AI Configuration

The system MUST provide `apps/api/src/config/ai.ts` that reads `OPENROUTER_API_KEY` (required) and `AI_MODEL` (optional, default: `google/gemini-2.5-flash:free`). The configuration MUST be validated at API bootstrap time alongside existing env checks.

#### Scenario: API starts with valid AI config
- **GIVEN** `OPENROUTER_API_KEY` is set and `AI_MODEL` is unset
- **WHEN** `apps/api` bootstraps
- **THEN** the AI config resolves to `google/gemini-2.5-flash:free`
- **AND** startup succeeds

#### Scenario: API fails fast on missing API key
- **GIVEN** `OPENROUTER_API_KEY` is not set
- **WHEN** `apps/api` bootstraps
- **THEN** startup exits non-zero with a clear error naming the missing variable

---

## ADDED Requirements — Analysis Error Handling

### Requirement: AI Failure Graceful Degradation

The system MUST handle AI call failures (network errors, rate limits, invalid responses) by setting the `AnalysisResult` status to `failed` with an error message. The system MUST allow retry by re-polling — the next poll cycle MUST re-attempt the AI call if status is `failed` and `progress === 100%`. The system MUST implement a maximum of 3 retry attempts before permanently marking the analysis as `failed`.

#### Scenario: Network error sets failed status
- **GIVEN** OpenRouter API is unreachable
- **WHEN** `DocumentAnalysisService` attempts the AI call
- **THEN** the `AnalysisResult` status is set to `failed`
- **AND** an error message is stored describing the failure

#### Scenario: Retry after transient failure
- **GIVEN** an analysis with `status: "failed"` and `progress: 100`
- **WHEN** the client polls again (retry attempt < 3)
- **THEN** the system re-attempts the AI call
- **AND** if successful, status becomes `completed` with entities

#### Scenario: Permanent failure after max retries
- **GIVEN** an analysis has failed 3 consecutive times
- **WHEN** the client polls again
- **THEN** the system does NOT re-attempt the AI call
- **AND** the status remains `failed` with retry count recorded

---

## MODIFIED Requirements — Document Schema

### Requirement: Document schema

The system MUST define a `Document` schema with fields: `id` (uuid string), `filename` (non-empty string), `mimeType` (enum: PDF, DOCX, JPG), `sizeBytes` (positive integer, max 25MB), `status` (enum: pending, uploading, uploaded, failed), `uploadedAt` (ISO datetime string), `filePath` (string, path to persisted file on disk, nullable for backward compatibility).

(Previously: Document schema had no `filePath` field — files were not persisted.)

#### Scenario: Valid document with filePath passes validation
- **GIVEN** a document object with all existing fields plus `filePath: "/uploads/abc123-report.pdf"`
- **WHEN** parsed by the Document schema
- **THEN** validation succeeds and `filePath` is accessible on the inferred type

#### Scenario: Document without filePath still valid (backward compat)
- **GIVEN** a legacy document object without `filePath`
- **WHEN** parsed by the Document schema
- **THEN** validation succeeds (filePath is optional/nullable)

---

## MODIFIED Requirements — API bootstrap contract

### Requirement: API bootstrap contract

`apps/api` MUST validate `PORT`, `NODE_ENV`, `DATABASE_URL`, and `OPENROUTER_API_KEY` before serving traffic. Startup MUST fail fast on invalid or missing env values. The `AI_MODEL` variable is optional and defaults to `google/gemini-2.5-flash:free`.

(Previously: API validated only `PORT`, `NODE_ENV`, and `DATABASE_URL`.)

#### Scenario: API starts with all required env including AI key
- **GIVEN** valid api env values including `OPENROUTER_API_KEY`
- **WHEN** the operator runs the pnpm command
- **THEN** the app listens on the configured port with AI services initialized

#### Scenario: API rejects missing AI key
- **GIVEN** `OPENROUTER_API_KEY` is missing
- **WHEN** the operator starts `apps/api`
- **THEN** startup exits non-zero before serving requests
- **AND** the error message identifies `OPENROUTER_API_KEY` as missing
