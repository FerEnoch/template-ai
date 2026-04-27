# Design: Workspace Foundation

## Technical Approach

Implement the smallest useful monorepo baseline: a root `pnpm` workspace (scoped to `apps/*`), shared TypeScript compiler defaults at root, and two bootstrap apps (`apps/web` Next.js, `apps/api` NestJS). Keep runtime code isolated per app and keep existing local PostgreSQL operations unchanged (`Makefile` + Compose).

This maps directly to the proposal scope and preserves the current `local-operational-infra` spec contract.

## Architecture Decisions

### Decision 1 — Workspace shape

| Option | Tradeoff | Decision |
|---|---|---|
| Single package until first feature | Less immediate setup, but forces repo reshape during feature delivery | Rejected |
| `pnpm` workspace with `apps/*` only | Small upfront setup, stable app boundaries early | **Chosen** |
| Full monorepo platform (`packages/*`, Nx/Turbo, release tooling) | Future-ready but premature complexity | Rejected |

### Decision 2 — Shared code strategy (now)

| Option | Tradeoff | Decision |
|---|---|---|
| Create `packages/shared` now | Anticipatory abstractions without proven duplication | Rejected |
| Share only tooling/config (`tsconfig.base.json`, lint/test conventions later) | Slight duplication initially, lower architecture risk | **Chosen** |

### Decision 3 — Command ownership boundary

| Option | Tradeoff | Decision |
|---|---|---|
| Put app run/build commands in Make | One entrypoint, but duplicated command surface and mixed concerns | Rejected |
| Keep Make for infra, pnpm for app lifecycle | Two tools, but clean operational boundaries | **Chosen** |

## Data Flow

Developer setup/run flow:

    make env-init ──→ make dev / make test-db-up
           │                    │
           │                    └─ manages PostgreSQL containers only
           │
           └─ pnpm install (root)
                 ├─ pnpm --filter @template-ai/web dev
                 └─ pnpm --filter @template-ai/api start:dev

Config inheritance flow:

    tsconfig.base.json (root)
          ├─ apps/web/tsconfig.json (extends root)
          └─ apps/api/tsconfig.json (extends root)

## Exact Root File Layout

```text
.
├── apps/
│   ├── web/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── next.config.ts
│   │   ├── src/app/page.tsx
│   │   └── src/app/layout.tsx
│   └── api/
│       ├── package.json
│       ├── tsconfig.json
│       ├── tsconfig.build.json
│       └── src/main.ts
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── .gitignore
├── Makefile
├── compose.yaml
├── compose.dev.yaml
├── compose.test.yaml
└── docs/local-operational-infra.md
```

## File Changes

| File | Action | Description |
|---|---|---|
| `package.json` | Create | Root workspace metadata, `packageManager`, and minimal cross-workspace scripts |
| `pnpm-workspace.yaml` | Create | Workspace packages: `apps/*` only |
| `tsconfig.base.json` | Create | Shared TS compiler defaults (strict, module resolution, path hygiene) |
| `.gitignore` | Modify | Ignore Node workspace artifacts (`node_modules`, `.next`, `dist`, coverage) |
| `apps/web/**` | Create | Minimal Next.js bootstrap only |
| `apps/api/**` | Create | Minimal NestJS bootstrap only |
| `Makefile` | Modify | Help text clarifies infra-only responsibility; no app script mirroring |
| `docs/local-operational-infra.md` | Modify | Explicit Make vs pnpm boundary |

## Interfaces / Contracts

Root scripts — **now**:
- `pnpm dev:web`, `pnpm dev:api`
- `pnpm lint`, `pnpm typecheck`
- optional `pnpm dev` (runs both apps concurrently if needed)

Root scripts/configs — **later (out of this change)**:
- `pnpm test` orchestration once real test suites exist
- CI-focused scripts, release/version tooling, task runners (Turbo/Nx), shared runtime packages

Workspace contract:

```yaml
# pnpm-workspace.yaml
packages:
  - apps/*
```

TS inheritance contract:

```json
{
  "extends": "../../tsconfig.base.json"
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Workspace wiring | Install and script resolution | `pnpm install`, run root scripts with `--filter` |
| App bootstrap | Each app starts with framework defaults | `pnpm --filter @template-ai/web dev`, `pnpm --filter @template-ai/api start:dev` |
| Infra boundary | Existing PostgreSQL contract unchanged | Re-run `make smoke` |

## Migration / Rollout

No data migration required. Rollout is one-step: add workspace/bootstrap files, keep infra behavior intact, then begin feature work on stable app paths.

## Open Questions

- [ ] Confirm exact supported Node LTS line for `engines.node` at root.
- [ ] Decide whether root `pnpm dev` should run both apps now or wait until API/web wiring exists.
