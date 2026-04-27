# Tasks: Workspace Foundation

## Phase 1: Root workspace baseline

- [x] 1.1 Create root `package.json` with `private`, `packageManager`, the chosen `engines.node` LTS line, and placeholder workspace scripts only for app orchestration.
- [x] 1.2 Create `pnpm-workspace.yaml` scoped only to `apps/*`, plus `tsconfig.base.json` and optional root `tsconfig.json` for workspace coordination.
- [x] 1.3 Update root `.gitignore` to ignore Node/pnpm outputs (`node_modules`, `.next`, `dist`, coverage, logs) without ignoring tracked `*.example` env files.
- [x] 1.4 Update `Makefile` help text so PostgreSQL lifecycle stays under `make` and app runtime/lint/typecheck commands are not mirrored there.

## Phase 2: App root scaffolds

- [x] 2.1 Scaffold `apps/web/package.json`, `apps/web/tsconfig.json`, `apps/web/next.config.ts`, and minimal `apps/web/src/app/layout.tsx` + `page.tsx` only.
- [x] 2.2 Add app-local web scripts/dependencies so root workspace commands can delegate to `@template-ai/web` without introducing feature code or Docker assets.
- [x] 2.3 Scaffold `apps/api/package.json`, `apps/api/tsconfig.json`, `apps/api/tsconfig.build.json`, Nest bootstrap entrypoints, and `src/interface`, `src/application`, `src/infrastructure` placeholders.
- [x] 2.4 Add app-local API scripts/dependencies so root workspace commands can delegate to `@template-ai/api` without adding domain, auth, or persistence implementation.

## Phase 3: Workspace command wiring and docs

- [x] 3.1 Wire root scripts such as `dev:web`, `dev:api`, `lint`, and `typecheck` to filtered pnpm app commands; add root `dev` only if both apps can be started cleanly now.
- [x] 3.2 Update `docs/local-operational-infra.md` to state that `make` owns PostgreSQL/Docker operations while pnpm owns app install, dev, lint, and typecheck on the host.

## Phase 4: Validation

- [x] 4.1 Run `pnpm install` at repo root and verify the workspace resolves only `apps/web` and `apps/api`.
- [x] 4.2 Run root `pnpm lint` and `pnpm typecheck` to confirm shared tooling works across both app scaffolds without adding business code.
- [x] 4.3 Validate `pnpm --filter @template-ai/web dev` and `pnpm --filter @template-ai/api start:dev` start the framework bootstraps independently.
- [x] 4.4 Re-run `make smoke` to confirm the existing PostgreSQL contract still passes and no app containers or Compose app services were introduced.
