# Design: Operational Infrastructure Minima

## Technical Approach

Implement a minimal local operational layer centered on PostgreSQL only: one shared Compose base (`compose.yaml`), two environment overrides (`compose.dev.yaml`, `compose.test.yaml`), and a `Makefile` that is the sole operator interface. This directly implements the proposal and ADR constraints: explicit env separation, reproducible commands, and no premature app/runtime infrastructure.

## Architecture Decisions

| Decision | Options | Tradeoffs | Choice |
|---|---|---|---|
| Compose structure | Profiles-only in one file; base + env overrides; fully separate per env | Profiles-only is compact but blurs env boundaries; fully separate files maximize isolation but duplicate shared service config | **Base + env overrides** |
| Command surface | Raw `docker compose`; Makefile wrappers | Raw compose leaks flags/project naming knowledge; Makefile adds maintenance but standardizes usage | **Makefile wrappers** |
| Env file policy | Single `.env`; env-specific `.env.*` | Single `.env` is simpler but invites cross-env contamination; split files are explicit and safer | **`.env.dev` / `.env.test` with tracked `.example`** |
| Resource namespacing | Hardcoded `container_name`; compose project naming | Hardcoded names collide and reduce flexibility; project naming gives isolated network/volume namespaces automatically | **Per-env compose project names** |
| Test DB lifecycle | Reuse dev DB; isolated test DB | Reuse is easy but unsafe/non-deterministic; isolated test DB is slightly more setup with predictable behavior | **Isolated test DB** |

### Why base + overrides (this repo, now)

- **Preferred over profiles-only**: current maturity is docs-first with no app services; explicit per-env files make boundaries obvious and reduce accidental mixed startup.
- **Preferred over fully separate files**: keeps one canonical PostgreSQL baseline (image, healthcheck, service shape) while allowing env-specific port/env/volume behavior in thin overrides.
- **Future-safe**: app services can be added once in base and tuned by env via overrides, avoiding structural rework.

## Data Flow

`Developer command` → `Make target` → `docker compose -f compose.yaml -f compose.{env}.yaml --project-name template_ai_{env}` → `Postgres service`

`env file (.env.{env})` → Compose env interpolation → DB name/user/password inside container

Isolation path:

`project-name` → separate network + volume namespace  
`port mapping` + `DB name` → concurrent dev/test access without collisions

## File Changes

| File | Action | Description |
|---|---|---|
| `Makefile` | Create | Standard entrypoint mapping stable targets to compose file pairs and per-env project names. |
| `compose.yaml` | Create | Shared PostgreSQL baseline (service definition + healthcheck, no env-specific host bindings). |
| `compose.dev.yaml` | Create | Dev overrides: env file, host port `5432`, persistent dev volume behavior. |
| `compose.test.yaml` | Create | Test overrides: env file, host port `5433`, isolated test storage/reset-friendly behavior. |
| `.env.dev.example` | Create | Template variables for dev DB (`template_ai_dev`, credentials placeholders, port docs). |
| `.env.test.example` | Create | Template variables for test DB (`template_ai_test`, credentials placeholders, port docs). |

## Interfaces / Contracts

### Makefile contract (minimum)

- Dev: `dev`, `dev-down`, `dev-logs`, `dev-ps`, `db-dev-shell`, `db-dev-reset`
- Test DB: `test-db-up`, `test-db-down`, `test-db-logs`, `db-test-shell`, `db-test-reset`
- `make test`: reserved placeholder that exits non-zero with guidance until real test runner exists.

### Compose naming contract

- Project names: `template_ai_dev`, `template_ai_test`
- Service key: `postgres` (no hardcoded container name)
- DB names: `template_ai_dev`, `template_ai_test`
- Host ports: `5432` (dev), `5433` (test)

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit | N/A for this phase | No code units introduced yet. |
| Integration | Compose + Make wiring | Smoke commands: up/down/logs/ps/shell/reset for both envs; verify concurrent startup works. |
| E2E | N/A | Deferred until app/runtime exists. |

## Migration / Rollout

No migration required. Rollout is additive: introduce files, copy `.env.*.example` to local `.env.*`, and operate via `make` targets.

## Risks, Tradeoffs, Rejected Alternatives

- **Risk**: Scope creep into app/prod infra. **Mitigation**: keep PostgreSQL-only assets.
- **Risk**: Drift between dev/test commands. **Mitigation**: mirrored target naming and shared base compose.
- **Tradeoff accepted**: small duplication in override files for explicitness.
- **Rejected**: profiles-only now (too implicit for strict env boundaries).
- **Rejected**: fully separate compose files now (too much duplication, weaker maintainability).

## Open Questions

- [ ] None blocking design. Production compose (`compose.prod.yaml`) remains intentionally deferred.
