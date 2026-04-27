# Local operational infrastructure (PostgreSQL only)

This project keeps local operational infra intentionally minimal and local-only.

## Scope

- Local PostgreSQL for **dev** and **test**.
- Make-driven operator commands.
- App lifecycle commands (`install`, `dev`, `lint`, `typecheck`) run via **pnpm** on host.
- No hosted CI, no app/runtime stack, no Redis/workers/migrations/seeds.

## Tool ownership boundary

- `make`: PostgreSQL + Docker Compose lifecycle only.
- `pnpm`: workspace/app lifecycle commands.

Examples:

```bash
pnpm install
pnpm dev:web
pnpm dev:api
pnpm lint
pnpm typecheck
```

## Bootstrap env files (explicit, opt-in)

Create local env files from the tracked examples:

```bash
make env-dev-init
make env-test-init
# or both:
make env-init
```

Normal start/reset/smoke commands will **not** auto-create env files.

## Core commands

```bash
make dev            # start dev DB on host 5432
make dev-down       # stop dev stack
make test-db-up     # start test DB on host 5433
make test-db-down   # stop test stack
make db-test-reset  # recreate only test DB storage
make smoke          # run local smoke contract checks
```

## Preflight behavior

- Commands that depend on `.env.dev`/`.env.test` fail fast before compose when files are missing.
- Error output names the missing file and points to `make env-*-init` (or copy from `*.example`).

## Readiness semantics

`make dev`, `make test-db-up`, `make db-dev-reset`, and `make db-test-reset` wait for PostgreSQL readiness via `pg_isready` with bounded retries. They fail clearly on timeout.

## `make smoke` contract

`make smoke` is the public smoke entrypoint and delegates to `scripts/smoke-local.sh`.

Smoke phases:

1. **preflight**: verifies `docker compose`, `.env.dev`, `.env.test`.
2. **compose-config**: validates dev/test compose pairing (`compose.yaml` + env override).
3. **startup/readiness**: starts missing stacks via `make dev` / `make test-db-up`.
4. **isolation**: asserts DB identities and published host ports (`5432` dev, `5433` test) while both stacks run.
5. **reset-scope**: writes sentinels to both DBs, runs `make db-test-reset`, verifies dev sentinel survives and test sentinel is removed.
6. **cleanup**: tears down only stacks started by smoke.

Smoke ends with an explicit summary:

- `SMOKE RESULT: PASS`
- `SMOKE RESULT: FAIL`

On any failed check, `make smoke` exits non-zero and prints the failed assertion before cleanup completes.
