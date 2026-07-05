# Delta for shared-contracts

## ADDED Requirements

### Requirement: UpdateTemplateNameSchema

The contracts package MUST export `UpdateTemplateNameSchema`: a Zod object with `name` (non-empty string, max 200 chars). The schema MUST be used by `PATCH /api/templates/:id`.

#### Scenario: Valid name passes validation

- GIVEN `{ name: "Contrato Alquiler" }`
- WHEN parsed by `UpdateTemplateNameSchema`
- THEN validation succeeds

#### Scenario: Empty name rejected

- GIVEN `{ name: "" }`
- WHEN parsed by `UpdateTemplateNameSchema`
- THEN validation fails with a min-length error

### Requirement: CaseSchema name field

The existing `CaseSchema` (used by `GET /api/cases`) MUST gain an optional nullable `name` field (`z.string().max(200).nullable().optional()`). When absent or null, consumers MUST treat `name` as unset.

(Previously: CaseSchema had no `name` field — cases displayed only the parent template name.)

#### Scenario: Case with name validates

- GIVEN a case object with `name: "Contrato Pérez"`
- WHEN parsed by `CaseSchema`
- THEN validation succeeds and `name` is accessible

#### Scenario: Case without name validates (backward compat)

- GIVEN a case object without a `name` field
- WHEN parsed by `CaseSchema`
- THEN validation succeeds with `name` as `null` or `undefined`

### Requirement: UpdateCaseFormDataSchema extended

`UpdateCaseFormDataSchema` MUST accept an optional `name` field, mirroring the `CaseSchema` shape. PATCH `/api/cases/:id` bodies that include `name` MUST validate against this schema.

#### Scenario: PATCH body with name validates

- GIVEN `{ name: "Renamed Case" }`
- WHEN parsed by `UpdateCaseFormDataSchema`
- THEN validation succeeds
