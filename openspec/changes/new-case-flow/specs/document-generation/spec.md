# document-generation Specification

## Purpose

AI-powered legal document generation from template entities, user-provided field values, and the original document's extracted text. Calls OpenRouter with a structured prompt and returns complete legal text.

## Requirements

| # | Requirement | MUST/SHALL |
|---|-------------|-----------|
| R1 | **Trigger Generation** — `POST /api/cases/:id/generate` MUST initiate synchronous AI generation. Case MUST be in `borrador` status. On success, status transitions to `generado` and `generated_text` is populated. | MUST |
| R2 | **Input Assembly** — The service MUST fetch `template.entities`, `casos.form_data`, and `analysis_results.extracted_text` (via `template.document_id`). If `extracted_text` is NULL, generation MUST proceed with entities + form data only. | MUST |
| R3 | **Prompt Construction** — The service MUST assemble a system message with role instructions and a user message concatenating entities, values, and base text. Temperature MUST be 0.3. Max tokens MUST be 16384. Response MUST use `json_schema` mode. | MUST |
| R4 | **Output Validation** — The OpenRouter response MUST validate against `GenerateDocumentResponseSchema`. On validation failure after retries, return 422. | MUST |
| R5 | **Error Resilience** — Retry on `RATE_LIMIT` and `NETWORK_ERROR` (3 attempts). On `INVALID_RESPONSE` or timeout, return 422. On OpenRouter unavailability, return 502. | MUST |
| R6 | **Idempotency** — Calling generate on an already `generado` case MUST re-trigger generation. Calling on `archivado` cases MUST return 409. | MUST |

## Scenarios

#### R1: Successful generation
- **Given** a case with status `borrador` and populated form data
- **When** `POST /api/cases/:id/generate` is called
- **Then** OpenRouter is invoked and `generated_text` is populated
- **And** case status transitions to `generado`

#### R2: Generation with missing base text
- **Given** the template's document has no `extracted_text`
- **When** generation is triggered
- **Then** the prompt uses entities and form data only
- **And** the preview page displays a warning banner

#### R5: OpenRouter timeout after retries
- **Given** OpenRouter does not respond within the timeout
- **After** exhausting 3 retry attempts
- **Then** a 422 error is returned and case remains `borrador`

#### R5: OpenRouter unavailable
- **Given** OpenRouter returns NETWORK_ERROR on all retries
- **When** the retry limit is reached
- **Then** a 502 error is returned

#### R6: Regenerate existing document
- **Given** a case with status `generado`
- **When** `POST /api/cases/:id/generate` is called
- **Then** `generated_text` is replaced with new output

#### R6: Cannot generate archived case
- **Given** a case with status `archivado`
- **When** `POST /api/cases/:id/generate` is called
- **Then** a 409 error is returned
