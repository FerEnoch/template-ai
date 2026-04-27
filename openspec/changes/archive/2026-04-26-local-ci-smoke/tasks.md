# Tasks: Local CI Smoke

## Phase 1: Entrypoint and scaffolding

- [x] 1.1 Update `Makefile` `.PHONY` and `help` to add a local-only `smoke` target; keep `make smoke` as the only public smoke entrypoint.
- [x] 1.2 Add the `smoke` recipe in `Makefile` so it delegates to `scripts/smoke-local.sh` and returns the helper exit status unchanged.
- [x] 1.3 Create `scripts/smoke-local.sh` with strict shell options, repo-root execution, phase logging, and immediate `trap cleanup EXIT` registration.

## Phase 2: Preflight and startup orchestration

- [x] 2.1 Implement preflight checks in `scripts/smoke-local.sh` for `docker compose`, `.env.dev`, and `.env.test`; fail before startup with explicit bootstrap guidance.
- [x] 2.2 Add baseline stack detection in `scripts/smoke-local.sh` to record whether dev/test were already running and set `STARTED_DEV` / `STARTED_TEST` only when smoke starts them.
- [x] 2.3 Implement ordered startup in `scripts/smoke-local.sh` by calling `make dev` and `make test-db-up` only when needed, with clear startup/readiness phase output.

## Phase 3: Contract assertions and reset scope

- [x] 3.1 Add local assertion helpers in `scripts/smoke-local.sh` to verify `current_database()`, expected published ports, and concurrent running status for both Compose stacks.
- [x] 3.2 Implement sentinel setup in `scripts/smoke-local.sh` with one minimal smoke table/row created separately in dev and test before reset verification.
- [x] 3.3 Run `make db-test-reset` from `scripts/smoke-local.sh`, then assert the dev sentinel still exists and the test sentinel is gone with clear failure output.

## Phase 4: Cleanup, operator guidance, and validation

- [x] 4.1 Implement `cleanup` in `scripts/smoke-local.sh` so only smoke-started stacks are stopped via `make dev-down` / `make test-db-down`, preserving pre-existing state.
- [x] 4.2 Update `Makefile` help text and create or restore `docs/local-operational-infra.md` to document `make smoke`, phase output, PASS/FAIL summary, env bootstrap, and local-only scope.
- [x] 4.3 Validate the workflow manually: missing-env fast fail, successful concurrent smoke with sentinel proof, clear non-zero failure messaging, and preserved pre-existing dev state after cleanup.

## Fix batch: verify reconciliation

- [x] 4.4 Reconcile helper exit-code scenario with GNU Make behavior by aligning the scenario to non-zero propagation while preserving `make smoke` as the public entrypoint and helper delegation.
