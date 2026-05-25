# Delta for app-bootstrap-runtime

## MODIFIED Requirements

### Requirement: Technical PostgreSQL bootstrap only

PostgreSQL integration MUST keep connect/check/disconnect and graceful shutdown as bootstrap duties. It MAY add only the first persistence slice for `users`, `subscriptions`, and `usage_ledger`. It MUST NOT add other domain tables, product workflows, seeds, or unrelated business modules.

(Previously: PostgreSQL wiring allowed only technical lifecycle checks with no repositories, migrations, seeds, or domain logic.)

#### Scenario: Approved persistence slice coexists with bootstrap
- GIVEN the completed change
- WHEN API assets are reviewed
- THEN bootstrap health/readiness guarantees remain
- AND persistence is limited to `users`, `subscriptions`, and `usage_ledger`

#### Scenario: Out-of-scope persistence stays absent
- GIVEN the completed change
- WHEN introduced persistence artifacts are reviewed
- THEN templates, documents, cases, exports, and audit/event subsystems are absent
