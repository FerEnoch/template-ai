# Apply Progress: operational-infra-hardening

## Implementation Progress

**Change**: operational-infra-hardening  
**Mode**: Standard

### Completed Tasks
- [x] 1.1 Create root `.gitignore` with exact ignores for `.env.dev`, `.env.test`, and only local runtime leftovers introduced by this change; keep `.env.dev.example` and `.env.test.example` tracked.
- [x] 1.2 Update `compose.yaml` to replace `postgres:16-alpine` with an exact `postgres:16.x-alpine` patch tag confirmed at implementation time.
- [x] 2.1 Update `Makefile` `.PHONY` and `help` to expose `env-dev-init`, `env-test-init`, optional `env-init`, and required preflight targets.
- [x] 2.2 Implement `env-dev-init` and `env-test-init` in `Makefile` as idempotent copies from `.env.dev.example` and `.env.test.example` that never overwrite existing files.
- [x] 2.3 Implement `preflight-env-dev` and `preflight-env-test` in `Makefile` so compose-backed targets fail before Docker Compose with actionable bootstrap guidance.
- [x] 3.1 Add shared wait variables/helper logic in `Makefile` that polls `pg_isready` through the `postgres` service with bounded retries and a clear timeout error.
- [x] 3.2 Wire `wait-postgres-dev` and `wait-postgres-test` into `dev`, `test-db-up`, `db-dev-reset`, and `db-test-reset`; keep detached startup but return only after readiness succeeds.
- [x] 3.3 Review `db-dev-shell` and `db-test-shell` preconditions in `Makefile` so operator commands still target the same `postgres` service and env contract after the new helpers land.
- [x] 4.1 Update `docs/local-operational-infra.md` to document explicit bootstrap, fail-fast preflight, readiness wait and timeout behavior, local-only scope, and unchanged non-goals.
- [x] 4.2 Validate `.gitignore`, `compose.yaml`, and tracked example env files against the minimal-file and exact-image-tag spec scenarios.

### Files Changed
| File | Action | What Was Done |
|------|--------|---------------|
| `.gitignore` | Created | Added exact ignore entries for `.env.dev` and `.env.test` only. |
| `compose.yaml` | Modified | Pinned PostgreSQL image to exact patch-level Alpine tag `postgres:16.13-alpine3.23`. |
| `Makefile` | Modified | Added explicit env bootstrap/preflight targets, shared bounded readiness helper, and readiness wiring for start/reset flows. |
| `docs/local-operational-infra.md` | Modified | Documented explicit bootstrap contract, fail-fast preflight, readiness wait semantics, timeout behavior, and local-only non-goals. |
| `openspec/changes/operational-infra-hardening/tasks.md` | Modified | Marked tasks 1.1–4.2 complete; left 4.3 pending due environment-specific validation blocker. |

### Deviations from Design
None — implementation matches design.

### Issues Found
- Docker image pull validation is blocked in this environment by a local credential helper/GPG timeout (`error getting credentials ... gpg: decryption failed: Timeout`), so full readiness-success validation against a running container could not be completed.

### Remaining Tasks
- [ ] 4.3 Run manual operator checks: missing-env failure for `make dev`, idempotent `make env-init`, readiness success for `make dev` and `make test-db-up`, and explicit timeout/non-zero behavior for a forced readiness failure.

### Status
10/11 tasks complete. Partial — ready for follow-up validation once Docker credential helper is healthy.
