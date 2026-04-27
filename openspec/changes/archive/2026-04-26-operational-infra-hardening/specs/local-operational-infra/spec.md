# Delta for local-operational-infra

## ADDED Requirements

### Requirement: Required env preflight and explicit bootstrap

Compose-backed commands that depend on `.env.dev` or `.env.test` MUST verify the required file before invoking Docker Compose. If missing, the command MUST fail early with a message that names the missing file and points to an explicit bootstrap command or the matching `*.example` file. Bootstrap MUST be opt-in and MUST NOT overwrite an existing env file.

#### Scenario: Missing dev env fails before Compose
- GIVEN `.env.dev` is absent
- WHEN the operator runs `make dev`
- THEN the command fails before Docker Compose starts
- AND the output names `.env.dev` and how to bootstrap it

#### Scenario: Bootstrap preserves existing env
- GIVEN `.env.test` already exists
- WHEN the operator runs the bootstrap command for test env files
- THEN the existing `.env.test` is left unchanged

### Requirement: Deterministic PostgreSQL readiness

`make dev`, `make test-db-up`, `make db-dev-reset`, and `make db-test-reset` MUST return only after PostgreSQL is reachable through `pg_isready` or after a bounded timeout with a clear failure message. Detached Compose startup alone SHALL NOT be treated as ready.

#### Scenario: Start waits until PostgreSQL is reachable
- GIVEN the dev stack is stopped and `.env.dev` exists
- WHEN the operator runs `make dev`
- THEN the command returns only after `pg_isready` succeeds for the dev database

#### Scenario: Timeout is explicit
- GIVEN PostgreSQL never becomes reachable
- WHEN the operator runs `make db-test-reset`
- THEN the command exits non-zero after the configured wait bound
- AND the output states that readiness timed out

### Requirement: PostgreSQL image pinning

The shared PostgreSQL service in `compose.yaml` MUST use an exact patch-level Alpine image tag. It MUST NOT use a floating major-only or minor-only tag, and this change MUST NOT require digest pinning.

#### Scenario: Image tag is exact
- GIVEN `compose.yaml` is reviewed
- WHEN the operator inspects the PostgreSQL image reference
- THEN the tag includes an explicit patch version and Alpine variant
- AND it is not a digest-pinned image

## MODIFIED Requirements

### Requirement: Minimal operational files

The repository MUST include `Makefile`, `compose.yaml`, `compose.dev.yaml`, `compose.test.yaml`, `.env.dev.example`, `.env.test.example`, `docs/local-operational-infra.md`, and a root `.gitignore` as the minimum tracked file set for this capability. The `.gitignore` MUST ignore `.env.dev`, `.env.test`, and any local-only operational artifacts introduced by this change, and MUST NOT ignore the tracked example env files.
(Previously: The minimum tracked file set excluded `.gitignore` and treated six infra files as complete.)

#### Scenario: Required tracked files and ignore coverage are present
- GIVEN a fresh clone of the repository
- WHEN the operator reviews the tracked local-infra files and `.gitignore`
- THEN the minimum file set is present
- AND `.gitignore` protects local-only env artifacts without excluding `*.example` templates

### Requirement: Minimum operability documentation

The change MUST document bootstrap from `.env.dev.example` and `.env.test.example`, the preflight behavior when env files are missing, and the readiness/wait semantics for start and reset commands. The documentation MUST also state the local-only scope of this hardening change.
(Previously: Documentation only had to make the example env files and basic usage discoverable.)

#### Scenario: Operator can predict local workflow
- GIVEN no local env files exist
- WHEN the operator reads `docs/local-operational-infra.md`
- THEN the operator can identify how to bootstrap env files
- AND can tell that start/reset commands wait for PostgreSQL readiness or fail clearly

### Requirement: Explicit non-goals

This change MUST NOT introduce app containers, Dockerfiles, Redis, workers, migrations or seed containers, CI/CD workflows, or production deployment assets. It MUST NOT silently create `.env.dev` or `.env.test` from normal start/reset commands, and it MUST NOT expand image pinning beyond an exact patch-level Alpine tag.
(Previously: Non-goals only excluded broader infra additions.)

#### Scenario: Scope remains minimal
- GIVEN the completed hardening change
- WHEN the changed files are reviewed
- THEN only local PostgreSQL operator-hardening assets and docs are affected
- AND no broader runtime or delivery infrastructure is added
