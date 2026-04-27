# Proposal: Operational Infrastructure Minima

## Intent

Establish the smallest operational baseline that lets the repo start local development and DB-backed testing safely: a `Makefile` entrypoint, Docker Compose separation for dev/test, and PostgreSQL isolation by environment.

## Scope

### In Scope
- Add `Makefile` commands for dev DB lifecycle, test DB lifecycle, logs/status, `psql` access, and explicit reset flows.
- Add `compose.yaml` plus `compose.dev.yaml` and `compose.test.yaml` for PostgreSQL-only local stacks.
- Add `.env.dev.example` and `.env.test.example` documenting distinct DB names, ports, and credentials placeholders.

### Out of Scope
- App containers, Dockerfiles, Redis, workers, migrations/seeds containers, CI/CD, or production deployment assets.
- A real `make test` runner beyond a clear placeholder that preserves future semantics.

## Capabilities

### New Capabilities
- `local-operational-infra`: Minimal local operations contract for `Makefile`-driven environment startup and isolated PostgreSQL stacks.

### Modified Capabilities
- None.

## Approach

Use a shared Compose base with env-specific override files instead of profiles. Keep one `postgres` baseline in `compose.yaml`; put env-specific ports, env files, and storage behavior in `compose.dev.yaml` and `compose.test.yaml`. Route all developer interaction through `Makefile`, using distinct Compose project names so networks and volumes stay isolated without hardcoded container names. Preserve the path to `compose.prod.yaml`, but do not implement production now.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `Makefile` | New | Standard entrypoint for local DB operations |
| `compose.yaml` | New | Shared PostgreSQL service baseline |
| `compose.dev.yaml` | New | Dev-specific overrides |
| `compose.test.yaml` | New | Test-specific overrides |
| `.env.dev.example` | New | Dev env template |
| `.env.test.example` | New | Test env template |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Scope expands into full runtime infra | Med | Limit to PostgreSQL-only assets |
| Dev/test contamination | Med | Separate env files, ports, DB names, and Compose project names |

## Rollback Plan

Remove the new Makefile and Compose/env example files; no domain code or production systems are touched.

## Dependencies

- Docker Compose available locally.
- PostgreSQL image pull access.

## Success Criteria

- [ ] `make` exposes reproducible commands for dev/test DB lifecycle without requiring raw Compose flags.
- [ ] Dev and test PostgreSQL stacks run concurrently with isolated DB names, ports, and storage.
- [ ] The repo gains minimal operational scaffolding only, without introducing app runtime or production infrastructure.
