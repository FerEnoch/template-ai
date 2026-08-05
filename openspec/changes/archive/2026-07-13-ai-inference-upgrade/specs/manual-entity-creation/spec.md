# Delta for manual-entity-creation

## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: Text selection activation

"+ AGREGAR CAMPO" MUST appear in ALL entity group headers (seed: PARTES, INMUEBLE, FECHAS, ANEXOS, GENERAL, OTROS; AND any user-approved dynamic groups) and empty states. Clicking the button MUST enter text-selection mode. The button MUST be disabled with a subscription-tier tooltip when the 5-entity limit is reached.

(Previously: "+ AGREGAR CAMPO" only appeared in the 4 seed group headers: PARTES, INMUEBLE, FECHAS, ANEXOS.)

#### Scenario: Button appears in dynamic group header

- GIVEN user has approved "JORNADA" as a dynamic group
- WHEN the review step renders
- THEN the "JORNADA" group header shows "+ AGREGAR CAMPO"

#### Scenario: Button appears in GENERAL group header

- GIVEN the analysis result contains entities in the GENERAL group
- WHEN the review step renders
- THEN the "GENERAL" group header shows "+ AGREGAR CAMPO"

#### Scenario: Button disabled at limit

- GIVEN 5 manual entities exist
- WHEN the review step renders
- THEN "+ AGREGAR CAMPO" is disabled with tier-upgrade tooltip in ALL group headers

### Requirement: Entity creation confirmation

After classification, an EntityCreateModal MUST appear pre-filled with inferred `label`, `group`, and `value`. The user MAY adjust all fields before confirming. The `group` dropdown SHALL include: seed groups (PARTES/INMUEBLE/FECHAS/ANEXOS/GENERAL/OTROS) AND any user-approved dynamic groups for the template. Confidence MUST be locked to ALTA.

(Previously: group dropdown only included the 4 seed groups: PARTES, INMUEBLE, FECHAS, ANEXOS.)

#### Scenario: Modal group dropdown includes GENERAL and dynamic groups

- GIVEN template has approved dynamic group "JORNADA"
- WHEN EntityCreateModal opens
- THEN the group dropdown includes PARTES, INMUEBLE, FECHAS, ANEXOS, GENERAL, OTROS, JORNADA

#### Scenario: User adjusts group to a dynamic group

- GIVEN EntityCreateModal shows pre-filled `group: "GENERAL"`
- WHEN the user selects "JORNADA" from the dropdown and confirms
- THEN the entity is created with `group: "JORNADA"`
