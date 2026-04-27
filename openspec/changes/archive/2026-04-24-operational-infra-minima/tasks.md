# Tasks: Operational Infrastructure Minima

## Phase 1: Compose Foundation

- [x] 1.1 Create `compose.yaml` with one `postgres` service, shared image/healthcheck/env wiring, and no `container_name` or env-specific host ports.
- [x] 1.2 Create `compose.dev.yaml` to layer `compose.yaml` with `.env.dev`, host port `5432`, and isolated persistent dev storage.
- [x] 1.3 Create `compose.test.yaml` to layer `compose.yaml` with `.env.test`, host port `5433`, and isolated reset-friendly test storage.

## Phase 2: Operator Configuration Surface

- [x] 2.1 Create `.env.dev.example` with required PostgreSQL variables, copy/bootstrap comments, and defaults for `template_ai_dev`.
- [x] 2.2 Create `.env.test.example` with required PostgreSQL variables, copy/bootstrap comments, and defaults for `template_ai_test`.
- [x] 2.3 Create `Makefile` compose helpers that always call `docker compose -f compose.yaml -f compose.{env}.yaml --project-name template_ai_{env}`.
- [x] 2.4 Implement `Makefile` targets `dev`, `dev-down`, `dev-logs`, `dev-ps`, `db-dev-shell`, `db-dev-reset`, `test-db-up`, `test-db-down`, `test-db-logs`, `test-db-ps`, `db-test-shell`, and `db-test-reset`.
- [x] 2.5 Add `Makefile` `.PHONY` declarations and a reserved `test` target that exits non-zero with a clear “test runner not implemented yet” message.

## Phase 3: Validation and Isolation Checks

- [x] 3.1 Copy `.env.dev.example` to `.env.dev` and `.env.test.example` to `.env.test`, then verify `make dev` and `make test-db-up` can run concurrently.
- [x] 3.2 Run `make dev-ps`, `make test-db-ps`, `make dev-logs`, and `make test-db-logs` to confirm each target uses only its own override file and project name.
- [x] 3.3 Seed distinguishable data, run `make db-test-reset`, and verify only test storage is recreated while dev data remains intact.
- [x] 3.4 Run `make test` and confirm it fails with the reserved guidance message instead of starting databases.

## Phase 4: Scope Guardrails and Handoff

- [x] 4.1 Review `Makefile`, `compose*.yaml`, and `.env.*.example` for naming consistency (`postgres`, `template_ai_dev`, `template_ai_test`, `5432`, `5433`).
- [x] 4.2 Verify the change adds only PostgreSQL-focused local assets and no app containers, Dockerfiles, CI/CD files, or production compose artifacts.
