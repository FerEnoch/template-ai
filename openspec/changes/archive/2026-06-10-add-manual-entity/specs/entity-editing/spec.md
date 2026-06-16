# Delta for entity-editing

## MODIFIED Requirements

### Requirement: Entity edit modal trigger

The system MUST open an edit modal when the user clicks any entity row in the review step. The modal MUST support two modes: **edit** (default — label read-only, value editable, confidence toggleable between ALTA/MEDIA/BAJA) and **create** (label editable, value editable, confidence locked to ALTA with no toggle). Both modes MUST include an "Excluir" button.

(Previously: modal only supported edit mode with read-only label)

#### Scenario: Modal opens on entity click

- GIVEN the review step displays entity groups
- WHEN the user clicks an entity row
- THEN an edit modal appears with the entity's label, value, and confidence

#### Scenario: Label is read-only in edit mode

- GIVEN the edit modal is open in edit mode
- WHEN the user attempts to edit the entity label field
- THEN the field is disabled and cannot be modified

#### Scenario: Label is editable in create mode

- GIVEN the create modal is open with pre-filled label
- WHEN the user edits the label field
- THEN the change is reflected and saved on confirm

#### Scenario: Confidence is locked to ALTA in create mode

- GIVEN the create modal is open
- WHEN the user interacts with the confidence control
- THEN the toggle is disabled and the value remains ALTA

## ADDED Requirements

### Requirement: EntityCreateModal

The system MUST provide an EntityCreateModal that reuses the EntityEditModal dialog pattern with `mode="create"`. It MUST pre-fill `label`, `group`, and `value` from the classify-span response, lock `confidence` to ALTA, and allow the user to adjust fields before confirming. On confirm, the entity MUST be added to wizard state.

#### Scenario: Create modal pre-fills from AI response

- GIVEN classify-span returned `{ label: "Arrendatario", group: "PARTES", value: "Juan Pérez" }`
- WHEN EntityCreateModal renders
- THEN label, group, and value inputs are pre-filled

#### Scenario: User confirms with adjusted fields

- GIVEN EntityCreateModal is open with pre-filled data
- WHEN the user changes the group from "PARTES" to "INMUEBLE" and clicks confirm
- THEN the entity is added with the adjusted group

#### Scenario: Manual entity exclusion works identically

- GIVEN a manual entity exists
- WHEN the user opens its edit modal and clicks "Excluir"
- THEN the entity is marked excluded with strikethrough styling
