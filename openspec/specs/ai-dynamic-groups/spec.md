# ai-dynamic-groups Specification

## Purpose

Allow the AI model to suggest new entity group categories beyond the seed set. The user approves or rejects suggestions inline in the review step. Unclassified entities fall into a `GENERAL`/`OTROS` catch-all.

## Requirements

| # | Requirement | Strength | Summary |
|---|------------|----------|---------|
| R1 | Model-suggested groups | MAY | Extraction response MAY include `suggestedGroups` array |
| R2 | Inline user approval | MUST | Each suggested group renders as a chip with Approve / Reject |
| R3 | Approved groups join seed set | MUST | Approved groups included in subsequent extraction prompts |
| R4 | `GENERAL`/`OTROS` catch-all | MUST | Entities not matching any group assigned to `GENERAL`/`OTROS` |
| R5 | Suggested groups flow | MUST | Suggested groups persist per template; included in `{{groups}}` template var |
| R6 | Group naming constraints | SHALL | Suggested group names: 2-30 chars, uppercase, no special chars except `/` |

### Requirement R1: Model-suggested groups

The extraction response schema SHALL accept an optional `suggestedGroups: string[]` field. Each entry is a suggested new category name.

#### Scenario: Model suggests a new group

- GIVEN a laboral contract mentions "JORNADA" multiple times and it doesn't match any seed group
- WHEN the extraction runs
- THEN the response MAY include `suggestedGroups: ["JORNADA"]`

#### Scenario: No suggestions — field omitted

- GIVEN all entities fit into existing seed groups
- WHEN extraction runs
- THEN `suggestedGroups` is absent or empty — no UI rendered

### Requirement R2: Inline user approval

Each unique suggested group SHALL render as a chip with "✓ Aprobar" and "✗ Rechazar" buttons in the review step.

#### Scenario: User approves a suggested group

- GIVEN a "JORNADA" suggestion chip is shown
- WHEN user clicks "✓ Aprobar"
- THEN "JORNADA" is added to the template's approved groups AND all entities in that group are re-classified

#### Scenario: User rejects a suggested group

- GIVEN a "JORNADA" suggestion chip
- WHEN user clicks "✗ Rechazar"
- THEN the chip disappears AND entities assigned to "JORNADA" are re-assigned to `GENERAL`

### Requirement R3: Approved groups join seed set

Approved groups SHALL be persisted with the template and included in the `{{groups}}` template variable on subsequent extractions.

#### Scenario: Approved group appears in next extraction

- GIVEN "JORNADA" was approved in a previous extraction
- WHEN a new document is extracted using the same template
- THEN the prompt's `{{groups}}` includes `PARTES, INMUEBLE, FECHAS, ANEXOS, GENERAL, OTROS, JORNADA`

### Requirement R4: `GENERAL`/`OTROS` catch-all

Entities the model cannot classify into any known group SHALL be assigned to `GENERAL`. The `OTROS` group SHALL exist for user-facing grouping only — `GENERAL` is the canonical catch-all label.

#### Scenario: Unclassifiable entity → GENERAL

- GIVEN the model cannot map "Avenida Siempre Viva 742" to PARTES, INMUEBLE, FECHAS, or any approved dynamic group
- WHEN extraction runs
- THEN the entity's `group` is `GENERAL`

### Requirement R5: Suggested groups flow

`TemplateSchema` SHALL accept an optional `suggestedGroupsStatus` field: `{ groupName: "pending" | "approved" | "rejected" }`.

#### Scenario: Pending suggestion persists across reload

- GIVEN a template has `suggestedGroupsStatus: { JORNADA: "pending" }`
- WHEN the review step reloads
- THEN the approval chip still renders

### Requirement R6: Group naming constraints

Suggested group names MUST pass validation: 2-30 uppercase alphanumeric chars, `/` allowed. Reject anything else silently.

#### Scenario: Invalid name rejected

- GIVEN model suggests group name "trabajo" (lowercase)
- WHEN the response is validated
- THEN the suggestion is discarded and logged at WARNING level

## Notes

- Seed groups remain: `PARTES, INMUEBLE, FECHAS, ANEXOS, GENERAL, OTROS`.
- `OTROS` is a user-facing alias for `GENERAL` — both resolve to the same catch-all in the enum.
