# Design: Backend Frontend Bootstrap

## Technical Approach

Keep the bootstrap app-local and intentionally small. `apps/api` gets a Nest bootstrap that owns env validation, a single PostgreSQL pool, `/health` (process-only), and `/ready` (DB-aware). `apps/web` gets a neutral Next.js shell with Spanish metadata and public-only env boundaries. No shared runtime package, no business modules.

## Architecture Decisions

| Decision | Choice | Alternatives considered | Rationale |
|---|---|---|---|
| API env loading | Add `apps/api/src/config/env.ts` that reads `process.env`, validates `PORT`, `NODE_ENV`, `DATABASE_URL`, and exports typed config before `NestFactory.create()` | Inline `process.env` reads in `main.ts`; shared config package | Fail-fast startup with no cross-app coupling |
| PostgreSQL ownership | Create one app-local provider/service in `apps/api/src/infrastructure/postgres/` that constructs a `pg.Pool`, exposes `query`/`check` methods, and closes on shutdown | Per-request clients; shared DB package | Clear lifecycle ownership and simplest readiness signal |
| Readiness | `/health` returns `{status:"ok"}` without DB I/O; `/ready` executes `SELECT 1` through the pool and returns non-2xx on failure | TCP ping only; fold readiness into `/health` | Distinguishes process liveness from dependency health |
| Web shell | Use `apps/web/src/app/layout.tsx` + `page.tsx` only: `<html lang="es">`, Spanish metadata, neutral landing text, no client data fetching | Feature-like landing UI; API client bootstrap | Avoids implying product work that does not exist yet |
| Tooling boundary | pnpm owns app commands (`dev`, `build`, `start`, `lint`, `typecheck`); Make owns PostgreSQL/dev infra (`make dev`, `make test-db-up`, `make smoke`) | Duplicate DB startup in pnpm scripts; move app runtime into Make | Keeps infra lifecycle separate from app runtime |

## Data Flow

`pnpm --filter @template-ai/api start:dev` → `env.ts` validates config → `NestFactory.create(AppModule)` → `PostgresService` creates pool → controller serves `/health` and `/ready` → shutdown hook closes pool.

`pnpm --filter @template-ai/web dev` → Next loads `layout.tsx`/`page.tsx` → browser sees only `NEXT_PUBLIC_*` vars.

## File Changes

| File | Action | Description |
|---|---|---|
| `apps/api/src/main.ts` | Modify | Load validated config, register shutdown hooks, bind port from config |
| `apps/api/src/app.module.ts` | Modify | Wire config, health controller, and PostgreSQL provider |
| `apps/api/src/config/env.ts` | Create | Typed env validation and export |
| `apps/api/src/health/health.controller.ts` | Create | `/health` and `/ready` endpoints |
| `apps/api/src/infrastructure/postgres/postgres.service.ts` | Create | Pool ownership, ping, and close lifecycle |
| `apps/web/src/app/layout.tsx` | Modify | Spanish metadata and `lang="es"` |
| `apps/web/src/app/page.tsx` | Modify | Neutral shell page |
| `apps/web/.env.example` | Create | Public-only env contract note |
| `apps/api/.env.example` | Create | Server-only env contract note |
| `.atl/agents.md` | Modify | Minimal wording alignment: line 16 (testing), lines 113-118 (pnpm vs Make ownership note) |

## Interfaces / Contracts

```ts
export type ApiEnv = { PORT: number; NODE_ENV: "development" | "test" | "production"; DATABASE_URL: string };
```

`PostgresService` should own `Pool` creation and expose `ready(): Promise<boolean>` plus `close(): Promise<void>`; controllers should only depend on readiness, not query internals.

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit | Env validation, readiness success/failure, shutdown close path | Fast isolated tests around config/service |
| Integration | API boots with valid env and exposes both endpoints | Start app with test DB unavailable/available |
| E2E | Web shell renders Spanish metadata and neutral page | Browser check for title/lang/text |

## Migration / Rollout

No migration required.

## Open Questions

- [ ] None blocking; if a later phase wants reusable config, it should be proposed separately.

## `.atl/agents.md` Alignment

- **Line 16**: replace `Jest (backend NestJS)` with a neutral note like `backend test runner per app scripts` so the bootstrap does not imply a Jest setup that is not present yet.
- **Lines 113-118**: keep the ownership boundary explicit: `make` for PostgreSQL lifecycle/smoke, `pnpm` for app dev/start/lint/typecheck, and the existing `.npmrc` note as-is.
