# Tasks: Operational Infra Hardening

## Phase 1: Repo hygiene and base infra contract

- [x] 1.1 Create root `.gitignore` with exact ignores for `.env.dev`, `.env.test`, and only local runtime leftovers introduced by this change; keep `.env.dev.example` and `.env.test.example` tracked.
- [x] 1.2 Update `compose.yaml` to replace `postgres:16-alpine` with an exact `postgres:16.x-alpine` patch tag confirmed at implementation time.

## Phase 2: Env bootstrap and preflight

- [x] 2.1 Update `Makefile` `.PHONY` and `help` to expose `env-dev-init`, `env-test-init`, optional `env-init`, and required preflight targets.
- [x] 2.2 Implement `env-dev-init` and `env-test-init` in `Makefile` as idempotent copies from `.env.dev.example` and `.env.test.example` that never overwrite existing files.
- [x] 2.3 Implement `preflight-env-dev` and `preflight-env-test` in `Makefile` so compose-backed targets fail before Docker Compose with actionable bootstrap guidance.

## Phase 3: PostgreSQL readiness wiring

- [x] 3.1 Add shared wait variables/helper logic in `Makefile` that polls `pg_isready` through the `postgres` service with bounded retries and a clear timeout error.
- [x] 3.2 Wire `wait-postgres-dev` and `wait-postgres-test` into `dev`, `test-db-up`, `db-dev-reset`, and `db-test-reset`; keep detached startup but return only after readiness succeeds.
- [x] 3.3 Review `db-dev-shell` and `db-test-shell` preconditions in `Makefile` so operator commands still target the same `postgres` service and env contract after the new helpers land.

## Phase 4: Docs and validation

- [x] 4.1 Update `docs/local-operational-infra.md` to document explicit bootstrap, fail-fast preflight, readiness wait and timeout behavior, local-only scope, and unchanged non-goals.
- [x] 4.2 Validate `.gitignore`, `compose.yaml`, and tracked example env files against the minimal-file and exact-image-tag spec scenarios.
- [x] 4.3 Run manual operator checks: missing-env failure for `make dev`, idempotent `make env-init`, readiness success for `make dev` and `make test-db-up`, and explicit timeout/non-zero behavior for a forced readiness failure.
