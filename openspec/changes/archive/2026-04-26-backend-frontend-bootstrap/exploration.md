## Exploration: backend-frontend-bootstrap

### Current State
The repo already has the structural baseline for an app bootstrap: `pnpm` workspace scoped to `apps/*`, root TypeScript config, a minimal Next.js app in `apps/web`, and a minimal NestJS app in `apps/api`.

Current gaps for a usable bootstrap:
- `apps/api` has no config/env layer, no health/readiness endpoints, no PostgreSQL connection plumbing, and no graceful shutdown.
- `apps/web` only renders a placeholder page and lacks a real app shell boundary, metadata, and env wiring for future API consumption.
- `Makefile`/local infra already owns PostgreSQL lifecycle, but there is no app-start smoke contract yet.
- `.atl/agents.md` still says backend testing is Jest, which is not aligned with the current bootstrap state or repo scripts.

### Affected Areas
- `apps/api/src/main.ts` — bootstrap must load env, set port, and expose health/readiness.
- `apps/api/src/app.module.ts` — likely host for infra wiring needed for DB readiness only.
- `apps/api/src/**` — new minimal config/health/infrastructure placeholders.
- `apps/web/src/app/layout.tsx` — minimal shell/metadata and language need alignment.
- `apps/web/src/app/page.tsx` — should become a neutral shell, not fake business UI.
- `apps/web/next.config.ts` — only if env/runtime config requires explicit browser-safe exposure.
- `Makefile` / `docs/local-operational-infra.md` — only if app bootstrap commands need to be documented for host-run dev.
- `.atl/agents.md` — small consistency edits only.

### Approaches
1. **Host-run minimal bootstrap** — keep apps runnable via pnpm on the host, add only env loading, `/health` + `/ready`, and a bare web shell.
   - Pros: smallest useful step, preserves current operational contract, no fake abstractions.
   - Cons: still requires later feature work to add real modules.
   - Effort: Low

2. **Bootstrap plus shared app foundation** — introduce shared config/util packages for env, DB, and health across apps.
   - Pros: centralizes repeated plumbing.
   - Cons: premature shared-runtime coupling; violates current minimalism.
   - Effort: Medium

3. **Feature-shaped bootstrap** — add auth, DB repositories, API clients, and richer UI placeholders now.
   - Pros: looks more complete.
   - Cons: overengineered; mixes bootstrap with business/domain decisions.
   - Effort: Medium/High

### Recommendation
Choose **Approach 1**.

Minimum useful bootstrap should be:
- **API**: app-local env/config loader, `PORT`/`NODE_ENV`/`DATABASE_URL` validation, `/health` for liveness, `/ready` that reports PostgreSQL connectivity, and graceful shutdown for the DB client/pool.
- **API PostgreSQL**: technical connection only (pool init, connect/disconnect, readiness check), no repositories, migrations, or domain models.
- **Web**: neutral shell with app metadata, layout language set to Spanish, and a simple page that declares the app without inventing business UI.
- **Env plumbing**: app-local env files for dev/test, with the web reading only public-safe vars and the API reading server-only vars; keep the Makefile as the DB operator surface.
- **Operational boundary**: pnpm runs app dev/start/lint/typecheck on host; Makefile remains for PostgreSQL/dev/test smoke.
- **`.atl/agents.md` alignment**: change the backend testing line to match the actual bootstrap convention (avoid implying Jest is already wired) and clarify the pnpm-vs-Make ownership boundary if needed.

Explicit out of scope:
- domain/business logic, auth, repositories, migrations, seeds
- shared packages/libs and monorepo platform tooling
- app Dockerfiles/Compose services, CI/CD, reverse proxy, prod deployment

### Risks
- If readiness is only a TCP/process check, local smoke will be misleading; it should verify PostgreSQL connectivity.
- If env ownership is unclear between web/API/Makefile, the bootstrap will become confusing fast.
- If `.atl/agents.md` keeps Jest as a hard rule, future work will inherit a false testing contract.

### Ready for Proposal
Yes — the repo is ready for a narrowly scoped proposal for app shells, env/config plumbing, PostgreSQL readiness, and documentation-only consistency fixes.
