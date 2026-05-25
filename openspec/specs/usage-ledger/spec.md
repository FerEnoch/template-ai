# usage-ledger Specification

## Purpose

Define append-only MVP usage accounting.

## Requirements

### Requirement: Append-only fixed-unit usage

`usage_ledger` MUST append one immutable row for each counted analysis or generation. `user_id`, `operation_type`, and `created_at` MUST be present, `operation_type` MUST be limited to those two operations, and `units` MUST equal `1`.

#### Scenario: Analysis usage is recorded
- GIVEN a user completes one counted document analysis
- WHEN consumption is persisted
- THEN one new ledger row is appended with analysis type and `units = 1`

#### Scenario: Mutation of prior usage is forbidden
- GIVEN an existing usage row
- WHEN an actor attempts to update or delete it as normal business behavior
- THEN the mutation is rejected because the ledger is append-only

### Requirement: Ledger integrity and isolation

Each usage row MUST belong to exactly one user and MAY reference the effective subscription. The ledger MUST support owner-scoped queries with early PostgreSQL row-level isolation, and it MUST NOT become a generic audit stream or variable-weight quota system.

#### Scenario: Usage can be tied to access context
- GIVEN a counted operation happens during a subscription window
- WHEN the ledger row is stored
- THEN the row can reference that subscription without changing fixed-unit rules

#### Scenario: Unsupported usage shapes are rejected
- GIVEN a persistence attempt with another operation type or units other than `1`
- WHEN the ledger row is validated
- THEN persistence rejects the record
