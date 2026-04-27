# Proposal: Local CI Smoke

## Intent

Add a single local smoke command that proves the existing PostgreSQL operator contract still works end-to-end before any broader automation exists.

## Scope

### In Scope
- Add public `make smoke` entrypoint for local operators.
- Use one tiny shell helper (`scripts/smoke-local.sh`) only for ordered assertions, traps, and selective cleanup.
- Validate the exact contract: compose file pairing, bounded startup/readiness, concurrent dev/test isolation, and `make db-test-reset` affecting test only.

### Out of Scope
- GitHub Actions, remote CI, or any hosted pipeline.
- Reusing `make test`, app/runtime boot, migrations, seeds, Redis, workers, or broader platform checks.
- A general test framework; this stays a local operational smoke only.

## Capabilities

### New Capabilities
- None

### Modified Capabilities
- `local-operational-infra`: add a local smoke verification workflow for the existing PostgreSQL operational contract.

## Approach

`make smoke` remains the public entrypoint and delegates to a small helper script that:
1. Fails fast if `docker compose`, `.env.dev`, or `.env.test` are missing; it does not auto-bootstrap env files.
2. Starts dev via `make dev` and test via `make test-db-up`, reusing the current readiness waits.
3. Verifies dev resolves to `template_ai_dev` on host port `5432` and test resolves to `template_ai_test` on host port `5433`, with both stacks up concurrently under separate Compose projects/storage.
4. Creates sentinel data in both DBs, runs `make db-test-reset`, then confirms dev data survives and test data is removed.
5. Cleans up only resources started by smoke; it never resets dev.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `Makefile` | Modified | Add `smoke` entrypoint and help text |
| `scripts/smoke-local.sh` | New | Own sequential assertions and cleanup trap |
| `openspec/specs/local-operational-infra/spec.md` | Modified | Add smoke-check requirement delta |
| `openspec/changes/local-ci-smoke/proposal.md` | New | Proposal artifact |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Smoke disrupts an active local session | Med | Track what smoke started and only tear down that state |
| Missing operator doc file leaves smoke under-documented | Med | Capture behavior in spec now; restore docs later if needed |

## Rollback Plan

Remove `make smoke`, delete the helper script, and revert the spec delta; existing dev/test make targets continue unchanged.

## Dependencies

- Docker Engine with Compose plugin
- Initialized `.env.dev` and `.env.test`
- Host ports `5432` and `5433` available

## Success Criteria

- [ ] `make smoke` is the local public entrypoint and exits non-zero on contract failure.
- [ ] Smoke proves startup/readiness, concurrent dev/test isolation, and test-only reset semantics.
- [ ] Smoke preserves dev data and cleans up only what it started.
