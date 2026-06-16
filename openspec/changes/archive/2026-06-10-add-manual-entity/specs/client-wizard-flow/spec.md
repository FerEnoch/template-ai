# Delta for client-wizard-flow

## ADDED Requirements

### Requirement: ADD_ENTITY reducer action

The wizard reducer MUST handle an `ADD_ENTITY` action that appends a new entity to `state.entities`. The action payload MUST be a complete `Entity` object. Manual entity count MUST be derivable from state (entities where `sourceSpan` exists and entity was not produced by AI analysis).

#### Scenario: ADD_ENTITY appends entity to state

- GIVEN `state.entities` has 3 AI-detected entities
- WHEN `ADD_ENTITY` is dispatched with a new manual entity
- THEN `state.entities` length is 4
- AND the new entity is the last in the array

#### Scenario: Manual entity count derives from state

- GIVEN 2 entities with `sourceSpan` exist (user-created, no AI analysis association)
- WHEN the manual entity count is computed
- THEN the count is 2

### Requirement: addEntity() context method

`WizardContext` MUST expose `addEntity(entity: Entity)` that dispatches `ADD_ENTITY` and triggers draft persistence. The method MUST be callable from the review page component.

#### Scenario: addEntity persists entity to draft

- GIVEN `addEntity(newEntity)` is called
- WHEN draft is read from localStorage
- THEN the new entity is present in `entities[]`

### Requirement: Text selection mode state

Text selection mode MUST be tracked in the review page component (local state, not wizard global state). Entering selection mode MUST set a visual cue. Exiting selection mode MUST clear the cue. On text selection, the component MUST capture `window.getSelection()` offsets against `extractedText`.

#### Scenario: Selection mode activates visual cue

- GIVEN "+ AGREGAR CAMPO" is clicked
- WHEN selection mode state is set
- THEN document preview shows a highlight hint cursor
- AND existing `<mark>` elements are temporarily non-interactive

#### Scenario: Selection of existing highlight is detected

- GIVEN the user selects text overlapping an existing `<mark>` element
- WHEN `window.getSelection()` is captured
- THEN the component warns the user about overlap

## MODIFIED Requirements

### Requirement: Review entity interaction

The review step MUST display entity groups in expand/collapse panels. Each group header MUST include a "+ AGREGAR CAMPO" button. The button MUST trigger text selection mode when below the manual entity limit, and MUST be disabled with a tier-upgrade tooltip when the limit is reached. Each entity MUST show a confidence badge (ALTA, MEDIA, BAJA). The system MUST filter entities by confidence level. Entity rows MUST be clickable to open the edit modal. Excluded entities MUST be visually distinguished (strikethrough or dimmed) and filtered out by default. The review step MUST also render `state.extractedText` with entity highlights overlaid, reusing the same `renderHighlightedText()` utility for consistency. When `extractedText` is `null` or empty, the document preview area MUST show a fallback message ("Vista previa no disponible").

(Previously: entity groups had no manual creation button; text selection did not exist)

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

#### Scenario: Review renders extracted text with highlights

- GIVEN `state.extractedText` and entities with `sourceSpan` exist
- WHEN the review step renders
- THEN the document area shows the extracted text with `sourceSpan` characters highlighted

#### Scenario: "+ AGREGAR CAMPO" present in every group header

- GIVEN any entity group (PARTES, INMUEBLE, FECHAS, ANEXOS) is rendered
- WHEN the review step displays the group header
- THEN "+ AGREGAR CAMPO" button is visible

#### Scenario: Fallback when extractedText is missing

- GIVEN `state.extractedText` is `null` or empty
- WHEN the review step renders
- THEN the preview area shows "Vista previa no disponible"
