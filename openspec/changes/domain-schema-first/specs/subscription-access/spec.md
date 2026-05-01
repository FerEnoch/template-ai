# subscription-access Specification

## Purpose

Define persisted subscription state as MVP access truth.

## Requirements

### Requirement: Persisted access truth

`subscriptions` MUST persist access truth from stored status and period window. Access state MUST come from persisted business data, not billing workflow assumptions.

#### Scenario: Active window grants access state
- GIVEN a subscription with status `activa` and a current period window
- WHEN access state is queried
- THEN the persisted subscription is the source of truth for access

#### Scenario: Ended or denied window removes access
- GIVEN a subscription with status `sin_acceso` or an ended period window
- WHEN access state is queried
- THEN the persisted result denies new gated operations

### Requirement: Unambiguous user subscription state

The system MUST prevent ambiguous subscription truth per user. `user_id`, `status`, `period_start`, and `period_end` MUST be present, `period_end` MUST be later than `period_start`, overlapping windows for one user MUST be rejected, and owner-scoped access MUST be isolated with early PostgreSQL row-level protection.

#### Scenario: Overlapping current windows are rejected
- GIVEN a user already has a persisted effective subscription window
- WHEN another overlapping effective window is persisted
- THEN persistence rejects the overlap

#### Scenario: Cross-user subscription access is blocked
- GIVEN a subscription row belongs to one user
- WHEN another user context queries it
- THEN the row is not exposed
