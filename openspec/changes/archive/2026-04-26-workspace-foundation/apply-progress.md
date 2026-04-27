# Implementation Progress

**Change**: workspace-foundation  
**Mode**: Standard

## Completed Tasks

- [x] 1.1 Create root `package.json` with `private`, `packageManager`, chosen `engines.node` LTS line, and workspace orchestration scripts.
- [x] 1.2 Create `pnpm-workspace.yaml` scoped to `apps/*`, plus root `tsconfig.base.json` and coordination `tsconfig.json`.
- [x] 1.3 Update root `.gitignore` with Node/pnpm outputs while preserving current env-example tracking behavior.
- [x] 1.4 Update `Makefile` help text to reinforce infra-only command ownership.
- [x] 2.1 Scaffold `apps/web` bootstrap root (`package.json`, `tsconfig.json`, `next.config.ts`, minimal app router entry files).
- [x] 2.2 Add app-local web scripts/dependencies for workspace delegation only.
- [x] 2.3 Scaffold `apps/api` bootstrap root (`package.json`, `tsconfig*.json`, `nest-cli.json`, bootstrap entrypoints, structural placeholders).
- [x] 2.4 Add app-local API scripts/dependencies for workspace delegation only.
- [x] 3.1 Wire root `dev:web`, `dev:api`, `lint`, and `typecheck` scripts via filtered pnpm commands.
- [x] 3.2 Update `docs/local-operational-infra.md` with explicit Make vs pnpm ownership boundary.
- [x] 4.1 Run `pnpm install` at repo root and verify workspace resolution for `apps/web` + `apps/api`.
- [x] 4.2 Run root `pnpm lint` and `pnpm typecheck`.
- [x] 4.3 Validate `pnpm --filter @template-ai/web dev` and `pnpm --filter @template-ai/api start:dev` bootstraps.
- [x] 4.4 Re-run `make smoke` and confirm PostgreSQL contract remains intact.

## Continuation Fix Batch (verify remediation)

- [x] Fixed the critical verify issue blocking task 4.2 reliability by removing the generated-artifact include (`.next/types/**/*.ts`) from `apps/web/tsconfig.json`, so fresh bootstrap lint/typecheck no longer depends on missing `.next` files.
- [x] Re-ran the targeted workspace contract validation only: root `pnpm lint` and root `pnpm typecheck` both pass.

## Files Changed

| File | Action | What Was Done |
|------|--------|---------------|
| `package.json` | Created | Root workspace metadata, Node engine, and filtered pnpm scripts |
| `pnpm-workspace.yaml` | Created | Workspace scope restricted to `apps/*` |
| `tsconfig.base.json` | Created | Shared TypeScript defaults for app inheritance |
| `tsconfig.json` | Created | Root coordination tsconfig |
| `.gitignore` | Modified | Added Node/pnpm output ignores |
| `apps/web/package.json` | Created | Next.js bootstrap metadata/scripts/deps |
| `apps/web/tsconfig.json` | Created | Web app tsconfig extending root base |
| `apps/web/next.config.ts` | Created | Minimal Next.js config |
| `apps/web/next-env.d.ts` | Created | Next.js TS env references |
| `apps/web/src/app/layout.tsx` | Created | Minimal app layout entry |
| `apps/web/src/app/page.tsx` | Created | Minimal app page entry |
| `apps/api/package.json` | Created | Nest bootstrap metadata/scripts/deps |
| `apps/api/tsconfig.json` | Created | API tsconfig extending root base |
| `apps/api/tsconfig.build.json` | Created | API build tsconfig |
| `apps/api/nest-cli.json` | Created | Nest CLI bootstrap config |
| `apps/api/src/main.ts` | Created | Minimal Nest bootstrap entrypoint |
| `apps/api/src/app.module.ts` | Created | Empty root module |
| `apps/api/src/interface/.gitkeep` | Created | Interface layer placeholder |
| `apps/api/src/application/.gitkeep` | Created | Application layer placeholder |
| `apps/api/src/infrastructure/.gitkeep` | Created | Infrastructure layer placeholder |
| `docs/local-operational-infra.md` | Modified | Clarified operational/tooling command ownership |
| `Makefile` | Modified | Added help note reinforcing pnpm ownership for app lifecycle |
| `openspec/changes/workspace-foundation/tasks.md` | Modified | Marked all tasks complete |
| `apps/web/tsconfig.json` | Modified | Removed `.next/types/**/*.ts` include to avoid bootstrap dependency on generated artifacts |
| `openspec/changes/workspace-foundation/apply-progress.md` | Modified | Merged prior apply progress with continuation fix-batch remediation evidence |

## Decisions Resolved

1. **Node LTS line for `engines.node`**: set to `>=22 <23` (current active LTS line appropriate for Next 15/Nest 10 baseline).
2. **Root `pnpm dev` orchestration**: deferred for now; only `dev:web` and `dev:api` are wired to keep bootstrap minimal and avoid introducing a root process supervisor dependency in this change.

## Deviations from Design

None — implementation matches design intent and scope. The optional root `pnpm dev` remained deferred, which is explicitly allowed by design as an open decision.

## Issues Found

- Initial bootstrap attempt with Next 14 failed to load `next.config.ts`; resolved by aligning to Next 15 where typed config is supported.
- Initial API bootstrap missed `@nestjs/platform-express`, preventing Nest HTTP driver startup; dependency added.
- First `make smoke` run failed because `.env.test` was absent locally; fixed by running `make env-test-init` before smoke.
- Verify remediation: root `pnpm lint`/`pnpm typecheck` failed in fresh bootstrap due to `.next/types/**/*.ts` include resolving missing generated files; fixed by limiting web tsconfig include set to source + `next-env.d.ts` only.

## Remaining Tasks

- [ ] None.

## Status

14/14 tasks complete. Continuation fix batch applied; ready for verify re-run.
