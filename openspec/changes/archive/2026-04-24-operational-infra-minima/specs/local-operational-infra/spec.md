# local-operational-infra Specification

## Purpose

Define the minimum local operational baseline for PostgreSQL-backed development and testing, with explicit environment separation and a `Makefile`-first workflow.

## Requirements

### Requirement: Minimal operational files

The repository MUST include `Makefile`, `compose.yaml`, `compose.dev.yaml`, `compose.test.yaml`, `.env.dev.example`, and `.env.test.example` as the complete file set for this change.

#### Scenario: Required files are present
- GIVEN a fresh clone of the repository
- WHEN an operator lists the tracked files for local infrastructure
- THEN all six required files are present
- AND no production compose file is required by this change

### Requirement: Make-driven developer entrypoints

The system MUST expose local database operations through `make` targets instead of requiring raw Compose commands. It MUST provide `dev`, `dev-down`, `dev-logs`, `dev-ps`, `db-dev-shell`, `db-dev-reset`, `test-db-up`, `test-db-down`, `test-db-logs`, `test-db-ps`, `db-test-shell`, and `db-test-reset`. `make test` SHALL remain reserved for the future automated test runner and, if present now, MUST fail with a clear instructional message.

#### Scenario: Start and inspect dev database
- GIVEN Docker Compose is available locally
- WHEN the operator runs `make dev` and then `make dev-ps`
- THEN the dev PostgreSQL stack is started and its status is shown without extra Compose flags

#### Scenario: Preserve future test semantics
- GIVEN no automated test runner exists yet
- WHEN the operator runs `make test`
- THEN the command does not masquerade as database setup
- AND it explains that test execution is not implemented yet

### Requirement: Compose structure and invocation model

The local stack MUST use `compose.yaml` as a shared PostgreSQL baseline and exactly one environment override file per run: `compose.dev.yaml` for dev or `compose.test.yaml` for test. Developers SHALL invoke these stacks through `make`, and the underlying Compose model MUST support running dev and test concurrently.

#### Scenario: Environment-specific stack selection
- GIVEN both override files exist
- WHEN the operator starts dev and test through their respective `make` targets
- THEN each target resolves the shared base plus only its own environment override
- AND both stacks can stay up at the same time

### Requirement: PostgreSQL isolation by environment

Development and test PostgreSQL instances MUST NOT share database name, host port, Compose project name, network namespace, or persistent storage. The implementation MUST use separate env files and MUST NOT rely on a hardcoded `container_name`. Dev SHOULD keep persistent storage; test MAY use isolated persistent or disposable storage, but reset MUST be cheap and explicit.

#### Scenario: Concurrent isolation
- GIVEN both stacks are started
- WHEN the operator inspects connection settings and storage identifiers
- THEN dev and test use different DB names, different host ports, and different Compose project names
- AND test storage is not reused by dev

#### Scenario: Explicit reset scope
- GIVEN both stacks have existing data
- WHEN the operator runs `make db-test-reset`
- THEN only the test database storage is recreated
- AND the dev database remains unchanged

### Requirement: Minimum operability documentation

The change MUST document startup expectations through the tracked `.env.dev.example` and `.env.test.example` files, including the required PostgreSQL variables and the environment-specific values that preserve isolation. No broader runtime documentation is required unless the operator cannot discover normal usage from `make` and the example files.

#### Scenario: Operator can bootstrap from tracked examples
- GIVEN no local `.env.dev` or `.env.test` files exist
- WHEN the operator reads the example env files
- THEN the required variables and environment-specific defaults are clear enough to create local env files and run the corresponding `make` targets

### Requirement: Explicit non-goals

This change MUST NOT introduce app containers, Dockerfiles, Redis, workers, migrations or seed containers, CI/CD workflows, or production deployment assets.

#### Scenario: Scope remains minimal
- GIVEN the completed change
- WHEN the infrastructure files are reviewed
- THEN only PostgreSQL-focused local operational assets are introduced
- AND no production or application runtime stack is added
