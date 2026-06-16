# Entity Editing Specification

## Purpose

Enable users to edit extracted entity values, adjust confidence levels, and exclude entities during the review step via a modal interface.

## Requirements

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

### Requirement: Entity row hover signal

The system MUST accept an optional `onEntityHover?: (id: string | null) => void` callback prop on `EntityInspector`. When a user hovers an entity row button, `onEntityHover(entity.id)` SHALL be called on `onMouseEnter`. When the pointer leaves the row, `onEntityHover(null)` SHALL be called on `onMouseLeave`. The signal MUST fire for ALL visible entity rows — including those without `sourceSpan`, and including excluded entities.

(Previously: no hover signal existed on entity rows)

#### Scenario: Hover over row with sourceSpan emits entity ID

- GIVEN `EntityInspector` renders an entity row button with `sourceSpan` present
- AND `onEntityHover` prop is provided
- WHEN the user moves the mouse over the row (`onMouseEnter` fires)
- THEN `onEntityHover` is called with the entity's `id` string
- AND on subsequent `onMouseLeave`, `onEntityHover` is called with `null`

#### Scenario: Hover over row without sourceSpan still emits signal

- GIVEN `EntityInspector` renders a user-created entity row without `sourceSpan`
- AND `onEntityHover` prop is provided
- WHEN the user moves the mouse over the row
- THEN `onEntityHover` is called with the entity's `id`
- AND on mouse leave, `onEntityHover(null)` is called

#### Scenario: Hover over excluded entity row still emits signal

- GIVEN an entity has `excluded: true` and is visible (dimmed, strikethrough)
- AND `onEntityHover` prop is provided
- WHEN the user hovers the excluded entity row
- THEN `onEntityHover` is called with the entity's `id`
- AND on mouse leave, `onEntityHover(null)` is called

#### Scenario: Rapid hover across multiple rows debounces cleanly

- GIVEN `onEntityHover` is provided
- WHEN the user rapidly moves the mouse across three entity rows (A → B → C)
- THEN calls are emitted in order: `onEntityHover(a.id)`, `onEntityHover(null)`, `onEntityHover(b.id)`, `onEntityHover(null)`, `onEntityHover(c.id)`
- AND no stale or duplicate `id` values linger after `onMouseLeave`

#### Scenario: onEntityHover not provided — no error

- GIVEN `EntityInspector` is rendered without `onEntityHover` prop
- WHEN the user hovers any entity row
- THEN no error is thrown
- AND existing behavior (click-to-edit modal) is unaffected
