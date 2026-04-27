# Design: Operational Infra Hardening

## Technical Approach

Keep the current local PostgreSQL-only Compose topology and harden the operator contract in four places: narrow repo hygiene, explicit env bootstrap/preflight, deterministic readiness waits in `Makefile`, and patch-level image pinning. This stays strictly local (dev/test DB operations only) and avoids CI/app/runtime expansion.

## Architecture Decisions

| Decision | Option | Tradeoff | Decision |
|---|---|---|---|
| `.gitignore` scope | Broad `.env*` patterns | Hides too much; risks masking tracked templates and future env artifacts | **Exact filenames only** (`.env.dev`, `.env.test`) |
| Missing env handling | Auto-create on `make dev` | Convenient but implicit and can hide placeholder credentials | **Fail-fast preflight + explicit bootstrap target** |
| Readiness mechanism | Compose-only healthcheck / `up --wait` | Varies by Compose version and operator UX remains implicit | **Makefile wait helper calling `pg_isready` with bounded timeout** |
| Postgres pinning depth | Floating `16-alpine`, patch tag, digest pin | Floating drifts; digest is heavy for local-only infra | **Patch-level Alpine tag** |

## Data Flow

`operator command` → `make target` → `preflight-env-{dev|test}` → `docker compose up -d postgres` → `wait-postgres-{dev|test}` (`pg_isready` poll loop) → success/timeout.

Reset flow:

`db-*-reset` → `docker compose down -v` → `docker compose up -d postgres` → same wait helper.

Failure path:

If preflight fails: stop immediately with actionable bootstrap message.
If wait times out: print clear timeout error, show `compose ps` + last postgres logs hint, exit non-zero.

## File Changes

| File | Action | Description |
|---|---|---|
| `.gitignore` | Create | Add only `.env.dev` and `.env.test`; keep `*.example` tracked by not using broad globs. |
| `Makefile` | Modify | Add explicit bootstrap (`env-dev-init`, `env-test-init`, optional `env-init`), preflight checks, and shared readiness wait helper used by start/reset targets. |
| `compose.yaml` | Modify | Replace `postgres:16-alpine` with fixed patch-level Alpine tag (e.g., `postgres:16.4-alpine`). |
| `docs/local-operational-infra.md` | Modify | Document bootstrap/preflight contract, readiness wait behavior, timeout expectations, and non-goals unchanged. |

## Interfaces / Contracts

```make
# explicit bootstrap (opt-in)
env-dev-init: ; test -f .env.dev || cp .env.dev.example .env.dev
env-test-init: ; test -f .env.test || cp .env.test.example .env.test

# preflight (mandatory for compose-backed targets)
preflight-env-dev: ; test -f .env.dev || (echo "Missing .env.dev. Run: make env-dev-init"; exit 1)
preflight-env-test: ; test -f .env.test || (echo "Missing .env.test. Run: make env-test-init"; exit 1)

# readiness (bounded)
# defaults: WAIT_RETRIES=30, WAIT_SLEEP=2 (≈60s total)
wait-postgres-dev: ; $(COMPOSE_DEV) exec -T postgres sh -lc 'pg_isready -U "$$POSTGRES_USER" -d "$$POSTGRES_DB"'
```

Behavior contract:
- `dev`, `test-db-up`, `db-dev-reset`, `db-test-reset` MUST run preflight + wait.
- Wait timeout MUST fail non-zero with explicit guidance (retry or inspect logs).
- Bootstrap targets MUST be idempotent and never overwrite existing `.env.*` files.

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Integration | Preflight failures | Remove `.env.dev`/`.env.test`; verify targets fail fast with bootstrap instruction. |
| Integration | Bootstrap behavior | Run `env-*-init` twice; verify file created once and not overwritten. |
| Integration | Readiness semantics | Run `make dev`, `make test-db-up`, resets; confirm command returns only after `pg_isready` success. |
| Integration | Timeout path | Force failure (bad credentials or stopped container); verify bounded timeout and non-zero exit. |

## Migration / Rollout

No migration required. Rollout is additive and local: pull changes, run `make env-init` once (or per-env init), then continue with existing `make` targets.

## Open Questions

- [ ] Confirm exact patch tag at implementation time (`16.x-alpine`) based on current upstream availability.

## Rejected Alternatives / Tradeoffs

- Rejected broad `.gitignore` (`.env*`, `*.env`): too risky for hiding tracked template files.
- Rejected implicit env auto-bootstrap in runtime targets: prioritizes convenience over explicit operator intent.
- Rejected digest pinning now: stronger immutability but unnecessary operational friction for this local-only baseline.
