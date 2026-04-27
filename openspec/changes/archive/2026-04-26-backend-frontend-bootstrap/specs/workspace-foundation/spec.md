# Delta for workspace-foundation

## MODIFIED Requirements

### Requirement: Web bootstrap root

`apps/web` MUST provide a Next.js bootstrap root with TypeScript/framework config, Spanish metadata, and a neutral page. It MUST be runnable through pnpm commands. It MUST NOT include business features, backend code, provider integrations, or Docker assets.
(Previously: `apps/web` only had to provide framework entry structure.)

#### Scenario: Web root contains only bootstrap shell assets
- GIVEN the repository after this change
- WHEN the operator inspects `apps/web`
- THEN the folder contains only bootstrap/config assets plus the shell layout and page
- AND no feature-specific modules or Docker files are present

### Requirement: API bootstrap root

`apps/api` MUST provide a NestJS bootstrap root with TypeScript config, bootstrap entrypoints, app-local env/config, health/readiness routing, and technical PostgreSQL wiring. It MUST be runnable through pnpm commands. It MUST NOT include business modules, repositories, auth logic, migrations, seeds, or external-provider adapters.
(Previously: `apps/api` only had to provide bootstrap entrypoints and empty placeholders.)

#### Scenario: API root contains only bootstrap runtime assets
- GIVEN the repository after this change
- WHEN the operator inspects `apps/api`
- THEN the folder contains bootstrap/config assets plus env, health, and technical PostgreSQL wiring
- AND no business, repository, or provider-specific implementation is present

### Requirement: Tooling and operational boundary

The existing Makefile and Compose PostgreSQL workflow MUST remain the local infrastructure surface. PostgreSQL lifecycle and smoke SHALL stay under `make`. App install, dev, lint, typecheck, and runtime commands MUST be owned by pnpm. Documentation and `.atl/agents.md` MUST state those boundaries and MUST NOT claim backend testing wiring that this bootstrap does not provide. This capability MUST NOT add app containers or Compose services.
(Previously: the boundary only required pnpm/Make command separation.)

#### Scenario: Infra ownership and guidance stay explicit
- GIVEN the completed change
- WHEN the operator reviews workspace scripts, infra docs, and `.atl/agents.md`
- THEN PostgreSQL lifecycle and smoke remain under `make`
- AND app runtime ownership and testing guidance are stated consistently
