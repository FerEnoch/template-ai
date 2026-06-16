# Delta for subscription-access

## ADDED Requirements

### Requirement: Manual entity limit per document

The system MUST enforce a maximum of 5 manually created entities per document for the current subscription tier. The server MUST reject `POST /api/review/:resultId/entities/classify-span` and `POST /api/review/:resultId/entities` with HTTP 403 and error code `MANUAL_ENTITY_LIMIT_REACHED` when the limit is exceeded. The frontend SHOULD check the count client-side before enabling the "+ AGREGAR CAMPO" button.

#### Scenario: Limit not reached allows creation

- GIVEN a document has 3 manual entities
- WHEN the user clicks "+ AGREGAR CAMPO"
- THEN the button activates text selection mode

#### Scenario: Limit reached blocks creation

- GIVEN a document has 5 manual entities
- WHEN the review step renders
- THEN "+ AGREGAR CAMPO" is disabled with upgrade tooltip

#### Scenario: Server enforces limit on bypass

- GIVEN a document has 5 manual entities
- WHEN a direct API call to classify-span is made
- THEN the server returns 403 `MANUAL_ENTITY_LIMIT_REACHED`

### Requirement: Subscription tier gating

The manual entity limit MUST be controlled by the subscription tier. Higher tiers MAY unlock more manual entities (>5). The limit MUST be derived from the persisted subscription state. The limit value MUST NOT be exposed to the client beyond the current tier's cap.

#### Scenario: Tier determines entity limit

- GIVEN the user's subscription tier allows 5 manual entities
- WHEN manual entity count is checked
- THEN the limit is 5

#### Scenario: Higher tier increases limit

- GIVEN the user upgrades to a higher subscription tier
- WHEN the limit is recalculated
- THEN the allowed manual entity count increases above 5
