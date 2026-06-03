# Delta for local-operational-infra

## MODIFIED Requirements

### Requirement: Explicit non-goals

This change MUST NOT introduce app containers, Dockerfiles, workers, migrations or seed containers, CI/CD workflows, or production deployment assets. This change MUST NOT introduce Redis as a separate production-style service — when Redis is required, it MUST be added only inside the local dev override (`compose.dev.yaml`) and MUST NOT be declared in the shared `compose.yaml` baseline. This change MUST NOT silently create `.env.dev` or `.env.test` from normal start/reset commands, and it MUST NOT expand image pinning beyond an exact patch-level Alpine tag.
(Previously: this change MUST NOT introduce app containers, Dockerfiles, Redis, workers, migrations or seed containers, CI/CD workflows, or production deployment assets.)

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

## ADDED Requirements

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
