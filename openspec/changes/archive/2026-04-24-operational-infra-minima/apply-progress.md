# Apply Progress: operational-infra-minima

## Implementation Progress

**Change**: operational-infra-minima  
**Mode**: Standard

### Completed Tasks
- [x] 1.1 Create `compose.yaml` with one `postgres` service, shared image/healthcheck/env wiring, and no `container_name` or env-specific host ports.
- [x] 1.2 Create `compose.dev.yaml` to layer `compose.yaml` with `.env.dev`, host port `5432`, and isolated persistent dev storage.
- [x] 1.3 Create `compose.test.yaml` to layer `compose.yaml` with `.env.test`, host port `5433`, and isolated reset-friendly test storage.
- [x] 2.1 Create `.env.dev.example` with required PostgreSQL variables, copy/bootstrap comments, and defaults for `template_ai_dev`.
- [x] 2.2 Create `.env.test.example` with required PostgreSQL variables, copy/bootstrap comments, and defaults for `template_ai_test`.
- [x] 2.3 Create `Makefile` compose helpers that always call `docker compose -f compose.yaml -f compose.{env}.yaml --project-name template_ai_{env}`.
- [x] 2.4 Implement `Makefile` targets `dev`, `dev-down`, `dev-logs`, `dev-ps`, `db-dev-shell`, `db-dev-reset`, `test-db-up`, `test-db-down`, `test-db-logs`, `test-db-ps`, `db-test-shell`, and `db-test-reset`.
- [x] 2.5 Add `Makefile` `.PHONY` declarations and a reserved `test` target that exits non-zero with a clear “test runner not implemented yet” message.
- [x] 3.1 Copy `.env.dev.example` to `.env.dev` and `.env.test.example` to `.env.test`, then verify `make dev` and `make test-db-up` can run concurrently.
- [x] 3.2 Run `make dev-ps`, `make test-db-ps`, `make dev-logs`, and `make test-db-logs` to confirm each target uses only its own override file and project name.
- [x] 3.3 Seed distinguishable data, run `make db-test-reset`, and verify only test storage is recreated while dev data remains intact.
- [x] 3.4 Run `make test` and confirm it fails with the reserved guidance message instead of starting databases.
- [x] 4.1 Review `Makefile`, `compose*.yaml`, and `.env.*.example` for naming consistency (`postgres`, `template_ai_dev`, `template_ai_test`, `5432`, `5433`).
- [x] 4.2 Verify the change adds only PostgreSQL-focused local assets and no app containers, Dockerfiles, CI/CD files, or production compose artifacts.

### Files Changed
| File | Action | What Was Done |
|------|--------|---------------|
| `compose.yaml` | Created | Added shared PostgreSQL service baseline with healthcheck and no env-specific host ports. |
| `compose.dev.yaml` | Created | Added dev override with `.env.dev`, host port `5432`, and isolated `postgres_dev_data` volume. |
| `compose.test.yaml` | Created | Added test override with `.env.test`, host port `5433`, and isolated `postgres_test_data` volume. |
| `.env.dev.example` | Created | Added bootstrap template for dev DB variables (`template_ai_dev`). |
| `.env.test.example` | Created | Added bootstrap template for test DB variables (`template_ai_test`). |
| `Makefile` | Created | Added standardized compose wrappers, required dev/test targets, `.PHONY`, `help`, and reserved failing `test` target. |
| `docs/local-operational-infra.md` | Created | Added minimal operator documentation for bootstrap and command usage. |
| `openspec/changes/operational-infra-minima/tasks.md` | Modified | Marked all change tasks complete. |

### Deviations from Design
None — implementation matches design.

### Issues Found
- During immediate validation after `db-test-reset`, first `psql` attempts can race the post-init restart in `postgres:16-alpine`; adding a short readiness wait resolves transient connection failures.

### Remaining Tasks
- [ ] None.

### Status
14/14 tasks complete. Ready for verify.
