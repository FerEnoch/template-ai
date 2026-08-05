# Delta for shared-contracts

## ADDED Requirements

### Requirement: Entity `reviewedAt` timestamp

The `EntitySchema` SHALL include `reviewedAt` (optional ISO datetime string, nullable). This field records when the user marked an entity as reviewed and serves as the sort key for FewShotProvider.

#### Scenario: Entity with reviewedAt validates

- GIVEN an entity with `reviewed: true` and `reviewedAt: "2026-01-15T10:30:00Z"`
- WHEN parsed by EntitySchema
- THEN validation succeeds and `reviewedAt` is accessible

#### Scenario: Entity without reviewedAt validates (backward compat)

- GIVEN a legacy entity without `reviewedAt`
- WHEN parsed by EntitySchema
- THEN validation succeeds (field is optional/nullable)

### Requirement: Dynamic group acceptance

The `ClassifySpanResponseSchema.group` field SHALL accept any non-empty string, enabling `GENERAL`/`OTROS` and model-suggested dynamic groups beyond the seed enum.

#### Scenario: classify-span returns GENERAL group

- GIVEN the AI classifies a span into `GENERAL`
- WHEN `ClassifySpanResponse` is validated
- THEN `group: "GENERAL"` passes validation

#### Scenario: classify-span returns dynamic group

- GIVEN the AI classifies a span as `JORNADA` (user-approved dynamic group)
- WHEN `ClassifySpanResponse` is validated
- THEN `group: "JORNADA"` passes validation

## MODIFIED Requirements

### Requirement: Entity schema

The system MUST define an `Entity` schema with fields: `id` (uuid string), `label` (non-empty string), `value` (string), `group` (non-empty string — accepts any non-empty string, not just seed enum), `confidence` (enum: alta, media, baja), `sourceSpan` (object with `start` and `end` positive integers, **optional/nullable**), `reviewed` (boolean, default false), `reviewedAt` (ISO datetime, optional/nullable), `excluded` (boolean, default false).

(Previously: `group` was `z.enum(["PARTES", "INMUEBLE", "FECHAS", "ANEXOS"])` in code, restricting groups to 4 real-estate categories. The spec said "non-empty string" but the code enum was narrower.)

#### Scenario: Valid entity with seed group passes

- GIVEN an entity with `group: "PARTES"`
- WHEN parsed by EntitySchema
- THEN validation succeeds

#### Scenario: Valid entity with GENERAL group passes

- GIVEN an entity with `group: "GENERAL"`
- WHEN parsed by EntitySchema
- THEN validation succeeds

#### Scenario: Valid entity with dynamic group passes

- GIVEN an entity with `group: "JORNADA"` (user-approved dynamic group)
- WHEN parsed by EntitySchema
- THEN validation succeeds

#### Scenario: Empty group rejected

- GIVEN an entity with `group: ""`
- WHEN parsed by EntitySchema
- THEN validation fails

#### Scenario: Entity without reviewedAt validates

- GIVEN an entity without `reviewedAt`
- WHEN parsed by EntitySchema
- THEN validation succeeds with `reviewedAt: undefined`

### Requirement: ClassifySpanResponse schema

The system MUST define a `ClassifySpanResponse` Zod schema with fields: `label` (non-empty string), `group` (non-empty string), `value` (string — mirrors input text).

(Previously: `group` was `z.enum(["PARTES", "INMUEBLE", "FECHAS", "ANEXOS"])` — only 4 seed groups.)

#### Scenario: Valid response with GENERAL passes

- GIVEN `{ label: "Lugar", group: "GENERAL", value: "Av. Central 123" }`
- WHEN parsed by `ClassifySpanResponse`
- THEN validation succeeds

#### Scenario: Valid response with dynamic group passes

- GIVEN `{ label: "Jornada", group: "JORNADA", value: "8 horas" }`
- WHEN parsed by `ClassifySpanResponse`
- THEN validation succeeds

### Requirement: Template schema

The system MUST define a `Template` schema with fields: `id`, `name`, `description`, `documentId`, `entities`, `category`, `createdAt`, `status`, and an optional `suggestedGroupsStatus` (record of `{ groupName: "pending" | "approved" | "rejected" }`).

(Previously: Template had no dynamic-group tracking field.)

#### Scenario: Template with suggested groups validates

- GIVEN a template with `suggestedGroupsStatus: { JORNADA: "pending" }`
- WHEN parsed by TemplateSchema
- THEN validation succeeds

#### Scenario: Template without suggested groups validates

- GIVEN a legacy template without `suggestedGroupsStatus`
- WHEN parsed by TemplateSchema
- THEN validation succeeds (field is optional)
