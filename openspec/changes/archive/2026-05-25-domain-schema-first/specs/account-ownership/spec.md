# account-ownership Specification

## Purpose

Define the ownership anchor for the first persisted slice.

## Requirements

### Requirement: Canonical user owner

`users` MUST persist one owner row per person. Duplicate normalized email and duplicate external subject MUST be rejected. Every user-owned row in this slice MUST reference that owner.

#### Scenario: Canonical owner is created
- GIVEN a new person enters the system
- WHEN the ownership record is persisted
- THEN one `users` row becomes the ownership anchor for subscriptions and usage

#### Scenario: Duplicate identity is rejected
- GIVEN an existing user with the same normalized email or external subject
- WHEN another ownership row is attempted
- THEN persistence rejects the duplicate

### Requirement: Single-tenant ownership boundary

This slice MUST stay single-tenant. Owner-scoped reads and writes MUST be isolated, early PostgreSQL row-level protection MUST apply to sensitive owner tables, and this slice MUST NOT add templates, source documents, billing workflows, or DB failure-code enums/catalogs.

#### Scenario: Owner-only account access
- GIVEN a persisted user row
- WHEN another user context attempts to read or mutate it through this slice
- THEN access is denied or filtered out

#### Scenario: Scope remains limited
- GIVEN the completed slice
- WHEN its persisted domain entities are reviewed
- THEN only `users`, `subscriptions`, and `usage_ledger` are present
