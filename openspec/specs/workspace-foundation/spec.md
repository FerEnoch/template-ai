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

`apps/web` MUST provide a Next.js bootstrap root with TypeScript/framework config, Spanish metadata, and a neutral page. It MUST be runnable through pnpm commands. It MUST NOT include business features, backend code, provider integrations, or Docker assets.

#### Scenario: Web root contains only bootstrap shell assets
- GIVEN the repository after this change
- WHEN the operator inspects `apps/web`
- THEN the folder contains only bootstrap/config assets plus the shell layout and page
- AND no feature-specific modules or Docker files are present

### Requirement: API bootstrap root

`apps/api` MUST provide a NestJS bootstrap root with TypeScript config, bootstrap entrypoints, app-local env/config, health/readiness routing, and technical PostgreSQL wiring. It MUST be runnable through pnpm commands. It MUST NOT include business modules, repositories, auth logic, migrations, seeds, or external-provider adapters.

#### Scenario: API root contains only bootstrap runtime assets
- GIVEN the repository after this change
- WHEN the operator inspects `apps/api`
- THEN the folder contains bootstrap/config assets plus env, health, and technical PostgreSQL wiring
- AND no business, repository, or provider-specific implementation is present

### Requirement: Tooling and operational boundary

The existing Makefile and Compose PostgreSQL workflow MUST remain the local infrastructure surface. PostgreSQL lifecycle and smoke SHALL stay under `make`. App install, dev, lint, typecheck, and runtime commands MUST be owned by pnpm. Documentation and `.atl/agents.md` MUST state those boundaries and MUST NOT claim backend testing wiring that this bootstrap does not provide. This capability MUST NOT add app containers or Compose services.

#### Scenario: Infra ownership and guidance stay explicit
- GIVEN the completed change
- WHEN the operator reviews workspace scripts, infra docs, and `.atl/agents.md`
- THEN PostgreSQL lifecycle and smoke remain under `make`
- AND app runtime ownership and testing guidance are stated consistently

### Requirement: Explicit non-goals

This capability MUST NOT deliver business logic, auth, migrations, seeds, repositories, shared runtime libraries, CI/CD workflows, reverse proxy assets, app Dockerfiles, app Compose services, or production deployment architecture.

#### Scenario: Scope remains bootstrap-only
- GIVEN the completed change
- WHEN the introduced files are reviewed
- THEN only workspace/tooling and empty framework foundations are added
- AND the listed non-goals are absent
