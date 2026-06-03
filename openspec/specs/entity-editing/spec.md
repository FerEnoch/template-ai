# Entity Editing Specification

## Purpose

Enable users to edit extracted entity values, adjust confidence levels, and exclude entities during the review step via a modal interface.

## Requirements

### Requirement: Entity edit modal trigger

The system MUST open an edit modal when the user clicks any entity row in the review step. The modal MUST display: entity label (read-only), current value (editable text field), confidence level (toggle between ALTA/MEDIA/BAJA), and an "Excluir" button.

#### Scenario: Modal opens on entity click

- GIVEN the review step displays entity groups
- WHEN the user clicks an entity row
- THEN an edit modal appears with the entity's label, value, and confidence

#### Scenario: Label is read-only

- GIVEN the edit modal is open
- WHEN the user attempts to edit the entity label field
- THEN the field is disabled and cannot be modified

### Requirement: Value editing

The system MUST allow the user to modify the entity's current value in the edit modal. Changes MUST be persisted via the wizard state and an MSW API call.

#### Scenario: Value updated successfully

- GIVEN the edit modal is open with entity value "Juan Pérez"
- WHEN the user changes the value to "Juan Carlos Pérez" and confirms
- THEN the entity value updates in the review view
- AND a PATCH request is sent to the mock API

#### Scenario: API failure shows inline error

- GIVEN the edit modal is open
- WHEN the user confirms a value change
- AND the mock API returns an error
- THEN an inline error message appears in the modal
- AND the original value is restored

### Requirement: Confidence toggle

The system MUST allow the user to cycle the entity's confidence level between ALTA, MEDIA, and BAJA via a toggle control in the edit modal.

#### Scenario: Confidence changed from ALTA to MEDIA

- GIVEN the entity has confidence "ALTA"
- WHEN the user clicks the confidence toggle
- THEN the confidence changes to "MEDIA"
- AND the badge in the review view updates

### Requirement: Entity exclusion

The system MUST allow the user to mark an entity as excluded via the "Excluir" button. Excluded entities MUST be visually distinguished and removed from the template output. Exclusion is NOT deletion — the entity remains in state with `excluded: true`.

#### Scenario: Entity excluded

- GIVEN the edit modal is open
- WHEN the user clicks "Excluir"
- THEN the entity is marked as excluded
- AND the entity row shows a strikethrough or dimmed state
- AND the entity is omitted from the saved template

#### Scenario: Excluded entity can be restored

- GIVEN an entity is marked as excluded
- WHEN the user opens the edit modal again
- THEN a "Restaurar" option is available to undo exclusion
