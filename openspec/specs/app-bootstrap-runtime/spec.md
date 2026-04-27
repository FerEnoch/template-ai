# app-bootstrap-runtime Specification

## Requirements

### Requirement: API bootstrap contract

`apps/api` MUST validate `PORT`, `NODE_ENV`, and `DATABASE_URL` before serving traffic. Startup MUST fail fast on invalid env.

#### Scenario: API starts from valid env
- GIVEN valid api env values
- WHEN the operator runs the pnpm command
- THEN the app listens on the configured port

#### Scenario: API rejects invalid env
- GIVEN `DATABASE_URL` is missing or invalid
- WHEN the operator starts `apps/api`
- THEN startup exits non-zero before serving requests

### Requirement: Web bootstrap contract

`apps/web` MUST provide a Next.js shell with Spanish metadata, `<html lang="es">`, and a neutral page.

#### Scenario: Web renders the shell
- GIVEN valid web env values
- WHEN the operator runs the pnpm command
- THEN the shell renders with Spanish metadata and `lang="es"`

### Requirement: Env and readiness boundaries

Env ownership MUST stay app-local: `apps/api` owns `DATABASE_URL` and other server-only values, and browser code MUST read only `NEXT_PUBLIC_*`. The API MUST expose `/health` for liveness and `/ready` for PostgreSQL readiness.

#### Scenario: Public and private env stay separate
- GIVEN the env contract
- WHEN the operator reviews env examples or docs
- THEN web runtime values are limited to `NEXT_PUBLIC_*`
- AND server-only values stay out of browser code

#### Scenario: Health is live while readiness is not ready
- GIVEN the api process is running and PostgreSQL is unavailable
- WHEN a client requests both endpoints
- THEN `/health` succeeds without a DB round trip
- AND `/ready` returns a non-success readiness result

### Requirement: Technical PostgreSQL bootstrap only

PostgreSQL integration MUST be limited to connect/check/disconnect, including graceful shutdown. It MUST NOT add repositories, migrations, seeds, or domain logic.

#### Scenario: PostgreSQL wiring stays technical
- GIVEN the completed change
- WHEN the operator reviews API assets
- THEN only connection lifecycle and readiness wiring are present

### Requirement: Explicit non-goals

This capability MUST NOT add business logic, auth, API clients, shared runtime libraries, app Dockerfiles, Compose app services, CI/CD, or deployment design.

#### Scenario: Scope remains bootstrap-only
- GIVEN the completed change
- WHEN introduced files are reviewed
- THEN the listed non-goals are absent
