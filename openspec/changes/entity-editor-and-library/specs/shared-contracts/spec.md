# Delta for shared-contracts

## MODIFIED Requirements

### Requirement: Entity schema

The system MUST define an `Entity` schema with fields: `id` (uuid string), `label` (non-empty string), `value` (string), `group` (non-empty string), `confidence` (enum: alta, media, baja), `sourceSpan` (object with `start` and `end` positive integers), `reviewed` (boolean, default false), `excluded` (boolean, default false).

(Previously: Entity schema did not include the `excluded` field)

#### Scenario: Valid entity passes validation

- GIVEN an entity with all required fields and confidence "alta"
- WHEN parsed by the Entity schema
- THEN validation succeeds

#### Scenario: Missing required field rejected

- GIVEN an entity without a `label`
- WHEN parsed by the Entity schema
- THEN validation fails

#### Scenario: Excluded field defaults to false

- GIVEN an entity without an `excluded` field
- WHEN parsed by the Entity schema
- THEN validation succeeds with `excluded: false`

#### Scenario: Excluded entity validates

- GIVEN an entity with `excluded: true`
- WHEN parsed by the Entity schema
- THEN validation succeeds
