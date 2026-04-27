# Proposal: Workspace Foundation

## Intent

Establish the minimum repo structure needed to start frontend and backend work without mixing first-feature delivery with repo reshaping. Adopt the ADR-selected workspace/tooling now, while preserving the current PostgreSQL local infra contract.

## Scope

### In Scope
- Adopt a root `pnpm` workspace limited to `apps/*`.
- Create empty/bootstrap app roots at `apps/web` (Next.js) and `apps/api` (NestJS).
- Add root-scoped tooling/config only: `package.json`, workspace file, shared TypeScript base, and minimal ignore/script alignment.
- Document how app commands relate to the existing Makefile and Docker Compose workflow.

### Out of Scope
- Business logic, auth, database access, migrations, seeds, or provider integrations.
- Shared runtime packages/libs (`packages/*`) and monorepo platform tooling (Turbo/Nx/Changesets).
- App Dockerfiles, app Compose services, reverse proxy, CI/CD, or production deployment architecture.

## Capabilities

### New Capabilities
- `workspace-foundation`: Minimal pnpm apps-only workspace with empty `web` and `api` app roots and shared root tooling boundaries.

### Modified Capabilities
- None.

## Approach

Create a boring monorepo baseline: root workspace config plus two isolated app folders. `apps/web` gets only framework bootstrap files; `apps/api` gets only Nest bootstrap and high-level folder placeholders. Root config shares tooling defaults, not runtime code. `Makefile` remains the operator surface for PostgreSQL and Docker; pnpm owns app install/run/lint/typecheck commands.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `package.json` | New | Root workspace metadata and minimal scripts |
| `pnpm-workspace.yaml` | New | Workspace limited to `apps/*` |
| `tsconfig.base.json` | New | Shared TS compiler defaults |
| `apps/web/` | New | Empty/bootstrap Next.js app root |
| `apps/api/` | New | Empty/bootstrap NestJS app root |
| `Makefile`, `docs/local-operational-infra.md` | Modified | Clarify boundary between Make infra commands and pnpm app commands |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Workspace scope grows prematurely | Med | Explicitly forbid `packages/*` and platform tooling in this change |
| Duplicate command surfaces | Med | Keep Make for DB/Docker only; keep app workflows in pnpm |

## Rollback Plan

Remove root workspace files and `apps/` scaffolds, then restore any documentation/Makefile wording that referenced app commands. Existing Compose/PostgreSQL behavior remains intact.

## Dependencies

- Node.js version aligned with ADR/tooling choice
- `pnpm`
- Next.js and NestJS bootstrap generators/packages

## Success Criteria

- [ ] The repo has a working root `pnpm` workspace limited to `apps/*`.
- [ ] `apps/web` and `apps/api` exist as empty/bootstrap app roots with app-local configs.
- [ ] Root tooling is shared only through config, not shared runtime packages.
- [ ] Make/Docker PostgreSQL workflows remain available and clearly separated from pnpm app workflows.
