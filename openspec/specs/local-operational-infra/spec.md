# local-operational-infra Specification

## Purpose

Define the minimum local operational baseline for PostgreSQL-backed development and testing, with explicit environment separation, fail-fast operator preflight, and a `Makefile`-first workflow.

## Requirements

### Requirement: Minimal operational files

The repository MUST include `Makefile`, `compose.yaml`, `compose.dev.yaml`, `compose.test.yaml`, `.env.dev.example`, `.env.test.example`, `docs/local-operational-infra.md`, and a root `.gitignore` as the minimum tracked file set for this capability. The `.gitignore` MUST ignore `.env.dev`, `.env.test`, and any local-only operational artifacts introduced by this change, and MUST NOT ignore the tracked example env files.

#### Scenario: Required files are present
- GIVEN a fresh clone of the repository
- WHEN an operator lists the tracked files for local infrastructure
- THEN the minimum file set is present
- AND `.gitignore` protects local-only env artifacts without excluding `*.example` templates

### Requirement: Make-driven developer entrypoints

The system MUST expose local database operations through `make` targets instead of requiring raw Compose commands. It MUST provide `dev`, `dev-down`, `dev-logs`, `dev-ps`, `db-dev-shell`, `db-dev-reset`, `test-db-up`, `test-db-down`, `test-db-logs`, `test-db-ps`, `db-test-shell`, and `db-test-reset`. `make test` SHALL remain reserved for the future automated test runner and, if present now, MUST fail with a clear instructional message.

#### Scenario: Start and inspect dev database
- GIVEN Docker Compose is available locally
- WHEN the operator runs `make dev` and then `make dev-ps`
- THEN the dev PostgreSQL stack is started and its status is shown without extra Compose flags

#### Scenario: Preserve future test semantics
- GIVEN no automated test runner exists yet
- WHEN the operator runs `make test`
- THEN the command does not masquerade as database setup
- AND it explains that test execution is not implemented yet

### Requirement: Required env preflight and explicit bootstrap

Compose-backed commands that depend on `.env.dev` or `.env.test` MUST verify the required file before invoking Docker Compose. If missing, the command MUST fail early with a message that names the missing file and points to an explicit bootstrap command or the matching `*.example` file. Bootstrap MUST be opt-in and MUST NOT overwrite an existing env file.

#### Scenario: Missing dev env fails before Compose
- GIVEN `.env.dev` is absent
- WHEN the operator runs `make dev`
- THEN the command fails before Docker Compose starts
- AND the output names `.env.dev` and how to bootstrap it

#### Scenario: Bootstrap preserves existing env
- GIVEN `.env.test` already exists
- WHEN the operator runs the bootstrap command for test env files
- THEN the existing `.env.test` is left unchanged

### Requirement: Compose structure and invocation model

The local stack MUST use `compose.yaml` as a shared PostgreSQL baseline and exactly one environment override file per run: `compose.dev.yaml` for dev or `compose.test.yaml` for test. Developers SHALL invoke these stacks through `make`, and the underlying Compose model MUST support running dev and test concurrently.

#### Scenario: Environment-specific stack selection
- GIVEN both override files exist
- WHEN the operator starts dev and test through their respective `make` targets
- THEN each target resolves the shared base plus only its own environment override
- AND both stacks can stay up at the same time

### Requirement: PostgreSQL isolation by environment

Development and test PostgreSQL instances MUST NOT share database name, host port, Compose project name, network namespace, or persistent storage. The implementation MUST use separate env files and MUST NOT rely on a hardcoded `container_name`. Dev SHOULD keep persistent storage; test MAY use isolated persistent or disposable storage, but reset MUST be cheap and explicit.

#### Scenario: Concurrent isolation
- GIVEN both stacks are started
- WHEN the operator inspects connection settings and storage identifiers
- THEN dev and test use different DB names, different host ports, and different Compose project names
- AND test storage is not reused by dev

#### Scenario: Explicit reset scope
- GIVEN both stacks have existing data
- WHEN the operator runs `make db-test-reset`
- THEN only the test database storage is recreated
- AND the dev database remains unchanged

### Requirement: Deterministic PostgreSQL readiness

`make dev`, `make test-db-up`, `make db-dev-reset`, and `make db-test-reset` MUST return only after PostgreSQL is reachable through `pg_isready` or after a bounded timeout with a clear failure message. Detached Compose startup alone SHALL NOT be treated as ready.

#### Scenario: Start waits until PostgreSQL is reachable
- GIVEN the dev stack is stopped and `.env.dev` exists
- WHEN the operator runs `make dev`
- THEN the command returns only after `pg_isready` succeeds for the dev database

#### Scenario: Timeout is explicit
- GIVEN PostgreSQL never becomes reachable
- WHEN the operator runs `make db-test-reset`
- THEN the command exits non-zero after the configured wait bound
- AND the output states that readiness timed out

### Requirement: Minimum operability documentation

The change MUST document bootstrap from `.env.dev.example` and `.env.test.example`, the preflight behavior when env files are missing, and the readiness/wait semantics for start and reset commands. The documentation MUST also state the local-only scope of this hardening change.

#### Scenario: Operator can bootstrap from tracked examples
- GIVEN no local `.env.dev` or `.env.test` files exist
- WHEN the operator reads `docs/local-operational-infra.md`
- THEN the operator can identify how to bootstrap env files
- AND can tell that start/reset commands wait for PostgreSQL readiness or fail clearly

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

### Requirement: PostgreSQL image pinning

The shared PostgreSQL service in `compose.yaml` MUST use an exact patch-level Alpine image tag. It MUST NOT use a floating major-only or minor-only tag, and this change MUST NOT require digest pinning.

#### Scenario: Image tag is exact
- GIVEN `compose.yaml` is reviewed
- WHEN the operator inspects the PostgreSQL image reference
- THEN the tag includes an explicit patch version and Alpine variant
- AND it is not a digest-pinned image

### Requirement: Explicit non-goals

This change MUST NOT introduce app containers, Dockerfiles, workers, migrations or seed containers, CI/CD workflows, or production deployment assets. Redis MUST remain a dev-only dependency declared exclusively in `compose.dev.yaml` and MUST NOT appear in the shared `compose.yaml` baseline. Redis now serves a dual role (BullMQ broker + cache store); key namespace and client wiring MUST prevent collisions without requiring a second Redis instance. This change MUST NOT silently create `.env.dev` or `.env.test` from normal start/reset commands, and it MUST NOT expand image pinning beyond an exact patch-level Alpine tag.
(Previously: Redis was introduced only as a BullMQ broker; its scope excluded any caching role.)

#### Scenario: Scope remains minimal

- GIVEN the completed change
- WHEN the infrastructure files are reviewed
- THEN only PostgreSQL-focused local operational assets and the dev-only Redis override are introduced
- AND no production or application runtime stack is added

#### Scenario: Redis lives only in the dev override

- GIVEN the completed change
- WHEN `compose.yaml` and `compose.dev.yaml` are reviewed
- THEN the shared `compose.yaml` baseline does not declare a Redis service
- AND `compose.dev.yaml` adds Redis only for local development

### Requirement: Redis service in dev compose override

The dev override (`compose.dev.yaml`) MUST add a Redis service using the `redis:7-alpine` image. The service MUST be isolated from test infrastructure (separate Compose project, separate host port, separate storage). The service MUST expose a healthcheck so dependent services can wait for readiness. `compose.yaml` (the shared baseline) MUST NOT be extended with a Redis service — Redis stays an opt-in dev-only dependency.

#### Scenario: Dev stack starts Redis with a healthcheck

- GIVEN `make dev` is invoked with the updated override
- WHEN the dev stack starts
- THEN a Redis container joins the dev network on a dedicated host port
- AND the service reports healthy before downstream consumers connect

#### Scenario: Test stack is unaffected by the Redis addition

- GIVEN the test stack is started via `make test-db-up`
- WHEN the operator inspects running containers
- THEN no Redis container is present in the test stack
- AND PostgreSQL isolation between dev and test is preserved

### Requirement: Redis env vars in dev example file

`.env.dev.example` MUST declare `REDIS_HOST` and `REDIS_PORT` with dev-friendly defaults (`localhost` and a port distinct from the test/dev PostgreSQL ports). The values MUST be safe to commit since the file is tracked. The dev bootstrap preflight MUST continue to verify `.env.dev` exists before starting Compose.

#### Scenario: Operator sees Redis vars in the example

- GIVEN a fresh clone
- WHEN the operator opens `.env.dev.example`
- THEN `REDIS_HOST` and `REDIS_PORT` are present with example values
- AND copying the example to `.env.dev` produces a working dev configuration

#### Scenario: Preflight still gates on missing env

- GIVEN `.env.dev` is absent
- WHEN the operator runs `make dev`
- THEN the preflight fails before Compose starts
- AND the output names `.env.dev` and points to explicit bootstrap guidance

### Requirement: Reduced request timeout for the API

The API server MUST use a `requestTimeout` of 30 seconds instead of the previous 10 minutes. The shorter timeout MUST NOT be paired with new synchronous long-running endpoints — async processing is what makes the shorter timeout safe. The change MUST be applied to `apps/api/src/main.ts` and MUST be documented in any developer-facing notes that reference the old 10-minute value.

#### Scenario: Timeout is 30 seconds at startup

- GIVEN the API starts with the new configuration
- WHEN the bootstrap configuration is logged or inspected
- THEN `requestTimeout` is 30 seconds

#### Scenario: Slow synchronous request still aborts at 30s

- GIVEN an HTTP handler does not respond within 30 seconds
- WHEN the timeout elapses
- THEN the server aborts the request
- AND the client receives a request-timeout response

### Requirement: Redis cache key namespace isolation

Redis keys used for AI caching MUST use the `ai:resp:` and `ai:text:` prefixes. Keys used by BullMQ MUST remain under the default `bull:` namespace (or the `analysis-queue` prefix already established). No cache key prefix MUST overlap with any BullMQ key namespace. The single Redis client instance MUST be shared across all consumers (BullMQ, text cache, AI response cache) without introducing a second Redis connection.

#### Scenario: Cache and queue keys do not collide

- GIVEN the dev stack is running with Redis
- WHEN a cache write (`ai:text:abc123`) and a BullMQ job enqueue occur concurrently
- THEN no key collision occurs
- AND both systems operate from the same Redis instance

#### Scenario: Single client serves all consumers

- GIVEN the NestJS application is booted
- WHEN `CachePort` is resolved and `BullModule` is initialized
- THEN both use the same underlying Redis connection
- AND no second Redis client is instantiated

### Requirement: Cache-specific env vars in dev example

`.env.dev.example` MUST declare `AI_CACHE_ENABLED`, `AI_RESPONSE_CACHE_TTL`, and `AI_TEXT_CACHE_TTL` with dev-safe defaults (`true`, `604800`, `604800`). The values MUST be safe to commit. The dev bootstrap preflight MUST continue to verify `.env.dev` exists before starting Compose.

#### Scenario: Operator sees cache vars in the example

- GIVEN a fresh clone
- WHEN the operator opens `.env.dev.example`
- THEN `AI_CACHE_ENABLED`, `AI_RESPONSE_CACHE_TTL`, and `AI_TEXT_CACHE_TTL` are present with example values
- AND copying to `.env.dev` produces a working dev configuration
