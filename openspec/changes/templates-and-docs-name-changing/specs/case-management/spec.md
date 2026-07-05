# case-management Specification

## Purpose

Manage generated cases (documents) produced from templates. Each case belongs to a template and a user. Cases can be renamed independently from their parent template.

## Requirements

### Requirement: Case schema

The system MUST define a `Case` type with fields: `id` (uuid), `templateId` (uuid), `userId` (integer), `status` (enum), `name` (string, nullable), `createdAt` (ISO datetime). When `name` is null, the display MUST fall back to `template.name`.

#### Scenario: Case with custom name

- GIVEN a case with `name: "Contrato Pérez – Sept 2026"`
- WHEN the case card renders
- THEN "Contrato Pérez – Sept 2026" is displayed

#### Scenario: Case without custom name falls back to template name

- GIVEN a case with `name: null` and parent template name "Contrato de Arrendamiento"
- WHEN the case card renders
- THEN "Contrato de Arrendamiento" is displayed

### Requirement: Case rename endpoint

`PATCH /api/cases/:id` MUST accept an optional `name` field (string, max 200 chars, nullable). The endpoint MUST enforce RLS — only the case owner can rename. Non-null case names MUST be unique per user via a partial UNIQUE (user_id, name) index that exempts NULL names (so unnamed documents keep falling back to their template name). A duplicate rename MUST return 409 with a Spanish message.

#### Scenario: Rename case via PATCH

- GIVEN a case with id "abc-123" owned by userId 0
- WHEN `PATCH /api/cases/abc-123` is called with `{ name: "Nuevo nombre" }`
- THEN the case name updates to "Nuevo nombre"

#### Scenario: Duplicate case name returns 409

- GIVEN a case owned by userId 0 already named "Contrato Pérez"
- WHEN userId 0 renames another case to "Contrato Pérez"
- THEN the response is 409
- AND the error message is `Ya existe un documento llamado "Contrato Pérez". Elegí otro nombre.`

#### Scenario: Cross-user rename returns 404

- GIVEN a case owned by userId 1
- WHEN userId 0 calls `PATCH /api/cases/:id` with `{ name: "Hacked" }`
- THEN the response is 404

### Requirement: Case rename via EditableName

Case cards on `/biblioteca` MUST expose inline rename via the `EditableName` component. The display text MUST be `case.name ?? template.name`.

#### Scenario: Double-click renames case

- GIVEN a case card showing a name
- WHEN the user double-clicks and saves a new name
- THEN `PATCH /api/cases/:id` is called and the card updates optimistically
