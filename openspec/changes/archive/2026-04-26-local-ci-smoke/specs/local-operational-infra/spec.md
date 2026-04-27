# Delta for local-operational-infra

## ADDED Requirements

### Requirement: Local smoke verification entrypoint

The system MUST provide `make smoke` as the public local-only smoke command for this capability. `make smoke` MUST exit non-zero when any verified contract check fails. If a helper script is used, it MUST be repo-local, invoked by `make smoke`, and remain an implementation detail rather than a second public operator entrypoint. Smoke MUST fail fast if `docker compose`, `.env.dev`, or `.env.test` are unavailable, and it MUST instruct the operator to bootstrap env files explicitly rather than creating them automatically.

#### Scenario: Missing env fails fast
- GIVEN `.env.test` is absent
- WHEN the operator runs `make smoke`
- THEN the command exits non-zero before starting Compose services
- AND the output names `.env.test` and points to explicit bootstrap guidance

#### Scenario: Helper script contract is preserved
- GIVEN the implementation uses a helper script
- WHEN the operator runs `make smoke`
- THEN the Make target delegates to that repo-local script
- AND the command exits non-zero whenever the helper fails (noting GNU Make may normalize failed recipe exits)

### Requirement: Smoke verifies the PostgreSQL local contract

The smoke workflow MUST verify only the existing local PostgreSQL operator contract. It MUST start dev through `make dev` and test through `make test-db-up`, relying on the existing bounded readiness behavior rather than bypassing it. It MUST validate that dev uses `compose.yaml` with `compose.dev.yaml`, test uses `compose.yaml` with `compose.test.yaml`, both stacks can run concurrently under isolated Compose/storage settings, dev resolves to `template_ai_dev` on host port `5432`, test resolves to `template_ai_test` on host port `5433`, and `make db-test-reset` removes only test sentinel data while preserving dev sentinel data.

#### Scenario: Smoke passes on a valid local setup
- GIVEN `.env.dev` and `.env.test` exist and host ports `5432` and `5433` are available
- WHEN the operator runs `make smoke`
- THEN dev and test become ready concurrently with the expected DB identities and ports
- AND sentinel checks prove dev data survives and test data is removed after `make db-test-reset`

#### Scenario: Startup or contract verification fails clearly
- GIVEN a readiness timeout or isolation mismatch occurs during smoke
- WHEN the operator runs `make smoke`
- THEN the command exits non-zero
- AND the output identifies the failed check before cleanup completes

### Requirement: Smoke cleanup, output, and non-goals

The smoke workflow MUST clean up only the resources it started itself and MUST NOT reset or tear down a pre-existing dev stack. It MUST restore the disposable test side to a stopped or cleaned state when smoke started it. Operator-facing output MUST identify the major phases of preflight, startup/readiness, isolation checks, test reset verification, and cleanup, and MUST end with a clear PASS or FAIL summary. This workflow MUST remain local-only and MUST NOT introduce hosted CI, app/runtime startup, migrations, seeds, Redis, workers, or repurposed `make test` behavior.

#### Scenario: Cleanup preserves pre-existing dev state
- GIVEN dev is already running before `make smoke`
- WHEN smoke finishes
- THEN the pre-existing dev stack remains available
- AND smoke cleans up only the resources it started during the run

#### Scenario: Scope remains local and minimal
- GIVEN the completed change
- WHEN operators review smoke-related assets and help text
- THEN the workflow is described as a local smoke check
- AND no hosted CI or broader platform verification is required
