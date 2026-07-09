# inline-name-editing Specification

## Purpose

Reusable React component and state machine for inline-editable text. Double-click to edit, Enter/blur to save, Escape to cancel. Used by template and case cards on `/biblioteca`.

## Requirements

### Requirement: EditableName component

The system MUST provide an `EditableName` React component that renders display text and transitions to an editable input on double-click. Saving MUST use `useTransition` to keep the input responsive during the PATCH request.

| State | Trigger | Behavior |
|-------|---------|----------|
| display | double-click on text | Switch to edit, focus input, select-all |
| edit | Enter or blur | Validate, call `onSave(name)`, show loading, revert on error |
| edit | Escape | Revert to display, discard changes |
| loading | PATCH in-flight | Show loading indicator, input remains focused |
| error | PATCH rejected | Show inline error, keep edit mode open, allow retry |

#### Scenario: Happy path rename

- GIVEN a template card with name "Contrato 1"
- WHEN the user double-clicks the name, types "Contrato Pérez", and presses Enter
- THEN `onSave("Contrato Pérez")` is called
- AND the display updates to "Contrato Pérez" on success

#### Scenario: Escape cancels edit

- GIVEN the user is editing with unsaved changes
- WHEN the user presses Escape
- THEN the input reverts to the original display text
- AND `onSave` is NOT called

#### Scenario: Empty name rejected client-side

- GIVEN the user clears the input and presses Enter
- WHEN the value is empty or whitespace-only
- THEN an inline error "El nombre no puede estar vacío" is shown
- AND no PATCH request is sent

#### Scenario: PATCH error rolls back

- GIVEN the user saves a new name that returns 409 (duplicate)
- WHEN the PATCH fails
- THEN the display reverts to the original name
- AND the inline error message from the API is shown

### Requirement: Click isolation

The component MUST call `e.stopPropagation()` on the input wrapper to prevent the surrounding card `<Link>` from navigating away when the user clicks to edit.

#### Scenario: Click on input does not navigate

- GIVEN a template card wrapped in a `<Link>` to the wizard
- WHEN the user clicks the `EditableName` input area
- THEN the click does NOT trigger the card's `Link` navigation
