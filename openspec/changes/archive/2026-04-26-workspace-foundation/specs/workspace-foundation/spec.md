# workspace-foundation Specification

## Purpose

Define the minimum pnpm workspace baseline for `apps/web` and `apps/api` while preserving the current Makefile + Docker Compose PostgreSQL workflow.

## Requirements

### Requirement: Root workspace foundation

The repository MUST provide a root pnpm workspace limited to `apps/*`. Root tracked workspace files MUST include `package.json`, `pnpm-workspace.yaml`, and `tsconfig.base.json`; a root `tsconfig.json` MAY exist only as a workspace coordination file. Root `.gitignore` MUST ignore Node/pnpm outputs introduced by this capability while continuing to track the existing `*.example` env files. Root configuration MUST remain tooling-only and MUST NOT introduce `packages/*`, Turborepo, Nx, Changesets, or shared runtime source code.

#### Scenario: Workspace root is minimal and apps-only
- GIVEN a fresh clone of the repository
- WHEN the operator reviews root workspace files and the workspace package globs
- THEN the repo exposes the required root files
- AND the workspace scope includes only `apps/*`

#### Scenario: Root tooling stays out of runtime sharing
- GIVEN the completed change
- WHEN the operator reviews root config and directories
- THEN root scripts/config are limited to workspace orchestration concerns
- AND no shared runtime package or `packages/` directory is introduced

### Requirement: Web bootstrap root

The system MUST provide `apps/web` as an app-local Next.js bootstrap root. It MUST include app-local package metadata, TypeScript config, framework config, and a minimal framework entry structure. It MUST be runnable through app-local pnpm scripts or delegated root workspace commands. It MUST NOT include business features, backend code, provider integrations, or Docker assets.

#### Scenario: Web root contains only framework bootstrap assets
- GIVEN the repository after this change
- WHEN the operator inspects `apps/web`
- THEN the folder contains only Next.js bootstrap/config assets and minimal entry files
- AND no feature-specific modules or Docker files are present

### Requirement: API bootstrap root

The system MUST provide `apps/api` as an app-local NestJS bootstrap root. It MUST include app-local package metadata, TypeScript config, Nest bootstrap entrypoints, and high-level folder placeholders for interface/controller, application/service, and infrastructure concerns. It MUST be runnable through app-local pnpm scripts or delegated root workspace commands. It MUST NOT include domain business modules, persistence implementation, auth logic, or external-provider adapters.

#### Scenario: API root contains only framework bootstrap assets
- GIVEN the repository after this change
- WHEN the operator inspects `apps/api`
- THEN the folder contains Nest bootstrap/config assets and empty high-level structural placeholders
- AND no business, persistence, or provider-specific implementation is present

### Requirement: Tooling and operational boundary

The existing Makefile and Compose PostgreSQL workflow MUST remain the operator surface for local infrastructure. Existing PostgreSQL-oriented `make` targets SHALL remain available for env bootstrap, start/stop, logs, shell, reset, smoke, and the reserved `make test` behavior defined by `local-operational-infra`. Workspace/app install, dev, lint, and typecheck commands MUST be owned by pnpm. Documentation and/or operator help MUST state that app runtimes execute via pnpm on the host and consume the existing local PostgreSQL stack. This capability MUST NOT add app containers or Compose app services.

#### Scenario: Infra and app command boundaries stay explicit
- GIVEN the completed change
- WHEN the operator reviews `Makefile`, workspace scripts, and local infra documentation
- THEN PostgreSQL lifecycle remains under `make`
- AND app runtime/tooling commands are clearly separated under pnpm

### Requirement: Explicit non-goals

This capability MUST NOT deliver business logic, auth, migrations, seeds, repositories, shared runtime libraries, CI/CD workflows, reverse proxy assets, app Dockerfiles, app Compose services, or production deployment architecture.

#### Scenario: Scope remains bootstrap-only
- GIVEN the completed change
- WHEN the introduced files are reviewed
- THEN only workspace/tooling and empty framework foundations are added
- AND the listed non-goals are absent
