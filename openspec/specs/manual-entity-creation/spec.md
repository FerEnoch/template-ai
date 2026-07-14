# manual-entity-creation Specification

## Purpose

Enable users to create entities manually via text selection with AI-assisted classification, capped at 5 per document and gated by subscription tier.

## Requirements

### Requirement: Text selection activation

"+ AGREGAR CAMPO" MUST appear in ALL entity group headers (seed: PARTES, INMUEBLE, FECHAS, ANEXOS, GENERAL, OTROS; AND any user-approved dynamic groups) and empty states. Clicking the button MUST enter text-selection mode with a visual cue (cursor change, highlight hint). The button MUST be disabled with a subscription-tier tooltip when the 5-entity limit is reached.

(Previously: "+ AGREGAR CAMPO" only appeared in the 4 seed group headers: PARTES, INMUEBLE, FECHAS, ANEXOS.)

#### Scenario: Button enters selection mode

- GIVEN a group header shows "+ AGREGAR CAMPO"
- WHEN the user clicks it
- THEN text-selection mode activates with a visual indicator

#### Scenario: Button disabled at limit

- GIVEN 5 manual entities exist
- WHEN the review step renders
- THEN "+ AGREGAR CAMPO" is disabled with tier-upgrade tooltip

#### Scenario: Button appears in dynamic group header

- GIVEN user has approved "JORNADA" as a dynamic group
- WHEN the review step renders
- THEN the "JORNADA" group header shows "+ AGREGAR CAMPO"

#### Scenario: Button appears in GENERAL group header

- GIVEN the analysis result contains entities in the GENERAL group
- WHEN the review step renders
- THEN the "GENERAL" group header shows "+ AGREGAR CAMPO"

### Requirement: Text selection and AI classification

Selecting text in the document preview MUST capture `selectedText`, `sourceSpan: { start, end }`, and ±100 characters of surrounding context. The system MUST send this to `POST /api/review/:resultId/entities/classify-span`. The backend MUST classify the span via AI and return `{ label, group, value }`.

#### Scenario: Successful classification

- GIVEN the user selects "Juan Pérez" in the preview
- WHEN the classify-span request completes
- THEN the response contains a valid `{ label, group, value }` object

#### Scenario: Multi-byte character offsets

- GIVEN `extractedText` contains accented Spanish characters (e.g., "José María")
- WHEN the user selects that text
- THEN `sourceSpan.start` and `sourceSpan.end` are correct byte-offset positions

### Requirement: Entity creation confirmation

After classification, an EntityCreateModal MUST appear pre-filled with inferred `label`, `group`, and `value`. The user MAY adjust `label` and `group` before confirming. The `group` dropdown SHALL include: seed groups (PARTES/INMUEBLE/FECHAS/ANEXOS/GENERAL/OTROS) AND any user-approved dynamic groups for the template. Confidence MUST be locked to ALTA.

(Previously: group dropdown only included the 4 seed groups: PARTES, INMUEBLE, FECHAS, ANEXOS.)

#### Scenario: Modal pre-filled with AI result

- GIVEN classify-span returns `{ label: "Arrendatario", group: "PARTES", value: "Juan Pérez" }`
- WHEN EntityCreateModal opens
- THEN label, group, and value are pre-filled and confidence shows ALTA (locked)

#### Scenario: User adjusts label before confirming

- GIVEN EntityCreateModal shows pre-filled `label: "Arrendatario"`
- WHEN the user changes it to "Arrendador" and confirms
- THEN the entity is created with the user-adjusted label

#### Scenario: Modal group dropdown includes GENERAL and dynamic groups

- GIVEN template has approved dynamic group "JORNADA"
- WHEN EntityCreateModal opens
- THEN the group dropdown includes PARTES, INMUEBLE, FECHAS, ANEXOS, GENERAL, OTROS, JORNADA

#### Scenario: User adjusts group to a dynamic group

- GIVEN EntityCreateModal shows pre-filled `group: "GENERAL"`
- WHEN the user selects "JORNADA" from the dropdown and confirms
- THEN the entity is created with `group: "JORNADA"`

### Requirement: Manual entity limit

The system MUST enforce a maximum of 5 manual entities per document. The server MUST reject `classify-span` and `POST /entities` with HTTP 403 `MANUAL_ENTITY_LIMIT_REACHED` when the limit is exceeded. The frontend SHOULD check the count optimistically.

#### Scenario: Server rejects 6th entity

- GIVEN 5 manual entities already exist for the document
- WHEN the frontend sends a classify-span request
- THEN the server returns 403 `MANUAL_ENTITY_LIMIT_REACHED`

### Requirement: Error handling

On AI classification timeout (>10s), malformed JSON, or network error, the system MUST display an inline error and allow retry. The user MAY proceed with manual label/group entry as fallback.

#### Scenario: AI timeout triggers retry option

- GIVEN classify-span request times out
- WHEN the error state renders
- THEN a "Reintentar" button is available
- AND the user may enter label/group manually

### Requirement: Post-creation entity visibility

A manually created entity MUST appear in the inspector with a "Con traza" badge (since `sourceSpan` exists). The entity MUST be editable via the existing EntityEditModal flow and MUST persist across page reloads via draft persistence.

#### Scenario: Manual entity shows "Con traza" badge

- GIVEN a manual entity with `sourceSpan: { start: 50, end: 62 }`
- WHEN the entity renders in the inspector
- THEN a "Con traza" badge is visible

#### Scenario: Manual entity editable post-creation

- GIVEN a manual entity exists in the review step
- WHEN the user clicks the entity row
- THEN the EntityEditModal opens with full edit capabilities

### Requirement: Fallback path for unclassifiable spans

When `classify-span` AI response returns a group that is not in the known set (seed + approved dynamic groups) or the response is malformed, the system SHALL default the group to `GENERAL` and allow the user to adjust before confirming.

#### Scenario: Unknown group defaults to GENERAL

- GIVEN the AI returns `{ label: "Foo", group: "UNKNOWN_CATEGORY", value: "bar" }`
- WHEN the backend processes the classification response
- THEN `group` is overridden to `GENERAL`
- AND the EntityCreateModal shows `GENERAL` as the pre-filled group with a note: "Grupo asignado automáticamente — puedes cambiarlo"

#### Scenario: Malformed classification response triggers fallback

- GIVEN the AI returns non-JSON or missing required fields
- WHEN the backend processes the response
- THEN a fallback entity is created with `label: ""`, `group: "GENERAL"`, `value: inputText`
- AND the modal opens for user to fill in missing fields

### Requirement: Dynamic group classification

`classify-span` MAY return any non-empty string for `group`, including `GENERAL`, `OTROS`, or user-approved dynamic groups.

#### Scenario: classify-span returns GENERAL

- GIVEN user selects a span the AI cannot classify into any seed group
- WHEN `POST /api/review/:resultId/entities/classify-span` is called
- THEN the response `group` is `GENERAL`

#### Scenario: classify-span returns a dynamic group

- GIVEN user has approved "JORNADA" as a dynamic group for the template
- WHEN classify-span runs on a work-schedule span
- THEN the response `group` MAY be `JORNADA`
