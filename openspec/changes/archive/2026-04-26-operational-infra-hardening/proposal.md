# Proposal: Operational Infra Hardening

## Intent

Harden the **local PostgreSQL operator contract** so startup/reset behavior is boring and deterministic. This removes accidental env-file commits, missing-env confusion, floating patch drift, and DB-ready races without expanding beyond local infra.

## Scope

### In Scope
- Add narrow repo hygiene for local env artifacts while keeping `*.example` files tracked.
- Add explicit env preflight and opt-in bootstrap targets for `.env.dev` and `.env.test`.
- Make current DB start/reset workflows wait until PostgreSQL is actually reachable.
- Pin PostgreSQL to an exact patch-level Alpine image tag.
- Update the local infra doc with the new operator contract.

### Out of Scope
- CI/CD, GitHub Actions, or deployment automation.
- Monorepo scaffolding, app services, Dockerfiles, proxies, migrations, or business logic.
- New infra dependencies such as Redis, queues, workers, or observability stacks.

## Capabilities

### New Capabilities
- None

### Modified Capabilities
- `local-operational-infra`: strengthen local env/bootstrap, PostgreSQL readiness semantics, repo hygiene, and image pinning requirements.

## Approach

Keep the existing Compose shape. Add a minimal `.gitignore`, explicit `make` bootstrap/preflight helpers, and a bounded wait helper that polls `pg_isready` after `up -d` and reset flows. Retain the Compose healthcheck, but make `make` the operator-facing readiness contract. Pin PostgreSQL to an exact patch tag; do not introduce digest pinning.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `.gitignore` | New | Ignore local env/runtime leftovers only |
| `Makefile` | Modified | Preflight, bootstrap, and DB wait helpers |
| `compose.yaml` | Modified | Patch-level PostgreSQL pinning |
| `docs/local-operational-infra.md` | Modified | Document bootstrap and wait semantics |
| `openspec/specs/local-operational-infra/spec.md` | Modified | Capture contract changes in spec phase |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Ignore rules hide tracked files | Low | Use exact env filenames, not broad wildcards |
| Bootstrap becomes implicit | Low | Require explicit bootstrap target; preflight fails loudly |
| Wait logic flakes across resets | Medium | Use bounded retries against `pg_isready` |

## Rollback Plan

Revert `.gitignore`, `Makefile`, `compose.yaml`, and doc changes. Operators can still run the prior Compose workflow manually if needed.

## Dependencies

- Local Docker Compose with PostgreSQL container `pg_isready` available.

## Success Criteria

- [ ] Missing `.env.dev` / `.env.test` fails early with clear bootstrap guidance.
- [ ] Bootstrap is explicit and preserves tracked example files as source templates.
- [ ] `make dev`, `make test-db-up`, `make db-dev-reset`, and `make db-test-reset` return only after PostgreSQL is reachable or time out clearly.
- [ ] PostgreSQL image uses an exact patch-level Alpine tag.
- [ ] Docs reflect the narrow local operator contract and non-goals.
