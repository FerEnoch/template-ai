# mock-service-layer Specification

## Purpose

Provide MSW (Mock Service Worker) request handlers that simulate the backend API with realistic latency, progressive data reveal, and test data — enabling end-to-end wizard flow demonstration without a real server.

## Requirements

### Requirement: MSW setup and toggle

The system MUST configure MSW in `apps/web/src/mocks/`. MSW MUST be enabled only when `NEXT_PUBLIC_API_MOCK=1` environment variable is set. The system MUST NOT intercept requests when mocking is disabled.

#### Scenario: Mock mode enabled

- GIVEN `NEXT_PUBLIC_API_MOCK=1` is set
- WHEN the app starts in development
- THEN MSW intercepts matching API requests

#### Scenario: Mock mode disabled

- GIVEN `NEXT_PUBLIC_API_MOCK` is not set or empty
- WHEN the app starts
- THEN MSW does not intercept any requests

### Requirement: Upload endpoint handler

The system MUST provide a handler for `POST /api/documents/upload`. The handler MUST simulate upload progress from 0 to 100% over 2 seconds. On completion, the handler MUST return a `Document` with status `uploaded` and a generated `id`.

#### Scenario: Successful upload returns document

- GIVEN a valid file upload request
- WHEN the handler processes it
- THEN a 200 response returns a Document with `status: "uploaded"` after ~2s

#### Scenario: Upload progress events emitted

- GIVEN an upload is in progress
- WHEN the client subscribes to progress
- THEN progress values increment from 0 to 100 over the simulated duration

### Requirement: Analysis endpoint handler

The system MUST provide a handler for `GET /api/analysis/:documentId`. The handler MUST return status `processing` for 3–5 seconds, then `completed` with a populated `entities` array. Entities MUST be revealed progressively (first 2–3, then the rest).

#### Scenario: Analysis completes with entities

- GIVEN a document has been uploaded
- WHEN the client polls `GET /api/analysis/:docId`
- THEN after 3–5s the response returns `status: "completed"` with 8+ entities

#### Scenario: Progressive entity reveal

- GIVEN analysis is in progress
- WHEN the client polls multiple times
- THEN early responses return fewer entities than the final response

### Requirement: Review endpoint handler

The system MUST provide a handler for `PATCH /api/entities/:entityId`. The handler MUST accept `reviewed` and `value` updates. The handler MUST return the updated entity.

#### Scenario: Entity review saved

- GIVEN an entity with `reviewed: false`
- WHEN `PATCH /api/entities/:id` is called with `{ reviewed: true }`
- THEN the response returns the entity with `reviewed: true`

### Requirement: Save endpoint handler

The system MUST provide a handler for `POST /api/templates`. The handler MUST validate the request body against the Template schema (minus `id` and `createdAt`). The handler MUST return 200 with the created Template after 200ms.

#### Scenario: Valid template saved

- GIVEN a valid template payload with name and documentId
- WHEN `POST /api/templates` is called
- THEN after 200ms a 200 response returns the Template with generated `id` and `createdAt`

#### Scenario: Invalid payload rejected

- GIVEN a template payload with empty `name`
- WHEN `POST /api/templates` is called
- THEN a 400 response returns with validation error details

### Requirement: Test data fixtures

The system MUST provide static test data in `mocks/data/`. Fixtures MUST include at least one valid Document, one AnalysisResult with 8 entities, and one Template. Fixtures MUST conform to the shared contracts schemas.

#### Scenario: Fixtures are schema-valid

- GIVEN the test data fixtures
- WHEN parsed by the corresponding Zod schemas
- THEN all fixtures pass validation

### Requirement: Latency simulation

All mock handlers MUST simulate realistic latency (200ms–5s depending on endpoint). The system MUST NOT respond instantly — instant responses mask loading state bugs.

#### Scenario: Upload has visible latency

- GIVEN an upload request
- WHEN the handler processes it
- THEN the response takes at least 1.5s to complete

### Requirement: GET templates endpoint

The system MUST provide a handler for `GET /api/templates`. The handler MUST return an array of saved templates from mock data. If no templates exist, the handler MUST return an empty array.

#### Scenario: Templates list returned

- GIVEN 3 templates exist in mock data
- WHEN `GET /api/templates` is called
- THEN a 200 response returns an array of 3 templates

#### Scenario: Empty list when no templates

- GIVEN no templates are saved
- WHEN `GET /api/templates` is called
- THEN a 200 response returns an empty array

### Requirement: Error scenario handlers

The system MUST provide error branches for: `POST /api/documents/upload` returning 500, `GET /api/analysis/:id` returning `status: "failed"`, and `POST /api/templates` returning 409 for duplicate names. Error responses MUST include a descriptive error message.

#### Scenario: Upload returns 500

- GIVEN the upload error scenario is triggered
- WHEN `POST /api/documents/upload` is called
- THEN a 500 response returns with an error message

#### Scenario: Analysis returns failed status

- GIVEN the analysis error scenario is triggered
- WHEN `GET /api/analysis/:id` is called
- THEN the response returns `status: "failed"`

#### Scenario: Save returns 409 conflict

- GIVEN a template with name "Contrato" already exists
- WHEN `POST /api/templates` is called with the same name
- THEN a 409 response returns with a duplicate name error

### Requirement: PATCH entity supports excluded field

The `PATCH /api/entities/:entityId` handler MUST accept an `excluded` boolean field. When `excluded: true`, the handler MUST update the entity's excluded status and return the updated entity.

#### Scenario: Entity marked as excluded

- GIVEN an entity with `excluded: false`
- WHEN `PATCH /api/entities/:id` is called with `{ excluded: true }`
- THEN the response returns the entity with `excluded: true`
