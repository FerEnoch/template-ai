# Delta for template-library-page

## ADDED Requirements

### Requirement: Template rename

Template cards on `/biblioteca` MUST expose inline rename via the `EditableName` component on the template name. A PATCH to `/api/templates/:id` persists the new name. Duplicate names MUST return 409.

(Previously: template name was static display-only text in the card.)

#### Scenario: Rename template via double-click

- GIVEN a template card showing "Contrato 1"
- WHEN the user double-clicks the name, types "Contrato Alquiler", and presses Enter
- THEN `PATCH /api/templates/:id` is called with `{ name: "Contrato Alquiler" }`
- AND the card updates to show the new name

#### Scenario: Duplicate name shows error

- GIVEN a template named "Arrendamiento" already exists
- WHEN the user renames another template to "Arrendamiento"
- THEN the PATCH returns 409
- AND the inline error "Ya existe una plantilla llamada Arrendamiento" is shown

#### Scenario: Escape cancels rename

- GIVEN the user is editing a template name
- WHEN the user presses Escape
- THEN the original name is restored and no PATCH is sent
