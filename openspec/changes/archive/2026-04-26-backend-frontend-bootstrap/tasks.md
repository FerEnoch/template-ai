# Tasks: Backend Frontend Bootstrap

## Phase 1: API bootstrap foundation

- [x] 1.1 Create `apps/api/src/config/env.ts` to parse and validate `PORT`, `NODE_ENV`, and `DATABASE_URL`, export a typed config object, and fail fast before Nest serves traffic.
- [x] 1.2 Create `apps/api/src/infrastructure/postgres/postgres.service.ts` with single `pg.Pool` ownership plus `ready()`/`close()` lifecycle methods; keep it technical only.
- [x] 1.3 Update `apps/api/package.json` and lockfile for the PostgreSQL runtime dependency needed by the bootstrap service, without adding test or platform packages.

## Phase 2: API readiness wiring

- [x] 2.1 Create `apps/api/src/health/health.controller.ts` with `/health` returning process liveness only and `/ready` delegating PostgreSQL readiness checks.
- [x] 2.2 Update `apps/api/src/app.module.ts` to register the health controller and PostgreSQL provider/service with app-local wiring only.
- [x] 2.3 Update `apps/api/src/main.ts` to load validated config before `NestFactory.create`, listen on the configured port, and close the PostgreSQL pool on shutdown.
- [x] 2.4 Add `apps/api/.env.example` documenting server-only variables and keeping browser-visible values out of the API env contract.

## Phase 3: Web bootstrap shell

- [x] 3.1 Update `apps/web/src/app/layout.tsx` to set Spanish metadata and `<html lang="es">` without adding product-specific providers or API clients.
- [x] 3.2 Update `apps/web/src/app/page.tsx` to render a neutral bootstrap shell in Spanish that does not imply business features.
- [x] 3.3 Add `apps/web/.env.example` documenting only `NEXT_PUBLIC_*` variables for future browser-safe configuration.

## Phase 4: Workspace guidance alignment

- [x] 4.1 Update `.atl/agents.md` to replace the current backend Jest claim with neutral per-app testing wording and restate `pnpm` app commands vs `make` PostgreSQL ownership.
- [x] 4.2 Review `docs/local-operational-infra.md` and update it only if the new app-local env examples or runtime commands need explicit bootstrap guidance.

## Phase 5: Validation

- [x] 5.1 Run `pnpm --filter @template-ai/api typecheck` and `pnpm --filter @template-ai/web typecheck` to verify the bootstrap wiring compiles cleanly.
- [x] 5.2 Verify API startup behavior: valid env boots on the configured port; invalid or missing `DATABASE_URL` fails before serving requests.
- [x] 5.3 Verify readiness semantics with PostgreSQL available and unavailable: `/health` stays successful without DB I/O, `/ready` succeeds only when `SELECT 1` passes.
- [x] 5.4 Verify the web shell from pnpm runtime: Spanish metadata is present, `lang="es"` is rendered, and only public-safe env values are referenced.
- [x] 5.5 Review introduced files to confirm no business modules, repositories, migrations, Docker app assets, CI/CD, or shared runtime packages were added.
