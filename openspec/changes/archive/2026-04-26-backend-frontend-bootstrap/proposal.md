# Proposal: Backend Frontend Bootstrap

## Intent

Make `apps/web` and `apps/api` technically runnable on top of the current pnpm + Make + PostgreSQL baseline, without mixing bootstrap work with domain features or platform overbuild.

## Scope

### In Scope
- Add app-local runtime bootstrap in `apps/api`: env/config validation (`PORT`, `NODE_ENV`, `DATABASE_URL`), infra-only PostgreSQL connection lifecycle, `/health`, and DB-aware `/ready`.
- Add app-local runtime bootstrap in `apps/web`: Spanish metadata/layout, neutral shell page, and public-only env contract for future API calls.
- Align operator/docs guidance so pnpm owns app runtime commands, Make keeps PostgreSQL ownership, and `.atl/agents.md` stops implying backend Jest wiring already exists.

### Out of Scope
- Business logic, auth, repositories, migrations, seeds, DTO-heavy modules, or API clients.
- Shared runtime packages/libs, monorepo platform tooling, or reusable config packages.
- App Dockerfiles, Compose app services, CI/CD, reverse proxy, observability stack, or production deployment design.

## Capabilities

### New Capabilities
- `app-bootstrap-runtime`: Minimal runtime contract for `apps/web` and `apps/api`, including env boundaries, API health/readiness, and infra-only PostgreSQL connectivity.

### Modified Capabilities
- `workspace-foundation`: extend app roots from framework-only scaffolds to minimally usable runtime shells.

## Approach

Keep everything app-local. `apps/api` gets a small config layer, one technical PostgreSQL provider/service, and a health controller; `/health` proves process liveness, `/ready` proves DB connectivity, and shutdown closes the pool cleanly. `apps/web` stays intentionally boring: metadata, `lang="es"`, and a neutral page; only `NEXT_PUBLIC_*` variables are browser-visible. No shared package extraction.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `apps/api/src/main.ts`, `app.module.ts` | Modified | Bootstrap, shutdown, module wiring |
| `apps/api/src/config/**`, `health/**`, `infrastructure/**` | New | Env, readiness, PostgreSQL technical connection |
| `apps/web/src/app/layout.tsx`, `page.tsx` | Modified | Neutral shell and metadata |
| `apps/web/.env*.example`, `apps/api/.env*.example` | New/Modified | App-local env contract |
| `.atl/agents.md` | Modified | Consistency-only testing/ownership wording |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Readiness becomes misleading | Med | Keep `/ready` DB-aware and `/health` process-only |
| Env ownership gets blurry | Med | Use explicit app-local variables and docs |

## Rollback Plan

Remove the app-local env/health/DB bootstrap files and revert `.atl/agents.md` wording; the repo falls back to bare framework scaffolds while the existing Make/PostgreSQL workflow stays intact.

## Dependencies

- Existing pnpm workspace baseline
- Existing local PostgreSQL stack from Make/Compose

## Success Criteria

- [ ] `apps/api` starts from validated env and exposes `/health` plus PostgreSQL-backed `/ready`.
- [ ] `apps/web` renders a neutral Spanish app shell and reads only public-safe env values.
- [ ] PostgreSQL wiring stays technical only: connect, check, disconnect; no domain persistence is added.
- [ ] `.atl/agents.md` matches the actual bootstrap/testing and pnpm-vs-Make ownership boundaries.
