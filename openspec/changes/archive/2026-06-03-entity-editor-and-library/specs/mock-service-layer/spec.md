# Delta for mock-service-layer

## ADDED Requirements

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
