# Delta for client-wizard-flow

## ADDED Requirements

### Requirement: Entity edit modal integration

The review step MUST allow clicking any entity row to open an edit modal. The modal changes MUST be reflected in the wizard state immediately (optimistic update). If the API call fails, the review step MUST display an inline error.

#### Scenario: Entity click opens modal

- GIVEN the review step displays entities
- WHEN the user clicks an entity row
- THEN an edit modal appears

#### Scenario: Inline error on API failure

- GIVEN the user confirms an entity edit
- WHEN the API call fails
- THEN an inline error appears on the review step

## MODIFIED Requirements

### Requirement: Review entity interaction

The review step MUST display entity groups in expand/collapse panels. Each entity MUST show a confidence badge (ALTA, MEDIA, BAJA). The system MUST filter entities by confidence level. Entity rows MUST be clickable to open the edit modal. Excluded entities MUST be visually distinguished (strikethrough or dimmed) and filtered out by default.

(Previously: Entity rows were display-only with no click interaction or exclusion state)

#### Scenario: Entity group expands on click

- GIVEN the "Partes" group is collapsed
- WHEN the user clicks the group header
- THEN the entity list expands showing individual fields

#### Scenario: Confidence filter reduces visible entities

- GIVEN entities with mixed confidence levels exist
- WHEN the user selects "ALTA only" filter
- THEN only high-confidence entities are shown

#### Scenario: Entity row opens edit modal

- GIVEN the review step displays entities
- WHEN the user clicks an entity row
- THEN the edit modal opens with the entity's details

#### Scenario: Excluded entity visually distinguished

- GIVEN an entity is marked as excluded
- WHEN the review step renders
- THEN the entity row shows a strikethrough or dimmed appearance
