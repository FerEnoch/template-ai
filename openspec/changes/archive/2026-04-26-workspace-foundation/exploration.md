## Exploration: workspace-foundation

### Current State
This repository is still pre-implementation from an application-code perspective. The accepted ADR already fixes the main stack choices: **Next.js** for frontend, **NestJS** for backend, **pnpm** + **TypeScript** + **Node.js** as base tooling, and a **Makefile + Docker Compose** operational model.

What exists today is only the local PostgreSQL operational baseline:
- `Makefile`
- `compose.yaml`, `compose.dev.yaml`, `compose.test.yaml`
- `.env.dev.example`, `.env.test.example`
- `docs/local-operational-infra.md`
- `openspec/specs/local-operational-infra/spec.md`

What does **not** exist yet:
- no `package.json`
- no `pnpm-workspace.yaml`
- no `tsconfig*.json`
- no `apps/` tree
- no shared packages/libs
- no frontend/backend runtime code

Because both `web` and `api` are already decided in the ADR, staying single-package a bit longer would only delay an inevitable repo reshaping. But going straight to a full monorepo with shared packages, task runners, and internal libraries would be premature.

### Affected Areas
- `docs/stack-technological-adr.md` — already mandates Next.js, NestJS, pnpm, TypeScript, Docker/Compose, and Makefile-first operations.
- `Makefile` — remains the operator entrypoint for local infra and should stay compatible with the workspace foundation.
- `compose.yaml` — shared PostgreSQL baseline that future app runtimes should consume, not replace.
- `compose.dev.yaml` — dev DB stack/app connection baseline.
- `compose.test.yaml` — test DB stack/app connection baseline.
- `.env.dev.example` — current dev environment contract that future app config will need to align with.
- `.env.test.example` — current test environment contract that future app config will need to align with.
- `openspec/specs/local-operational-infra/spec.md` — defines the minimal local infra contract and non-goals this change must preserve.
- `openspec/changes/workspace-foundation/exploration.md` — this exploration artifact.

### Approaches
1. **Delay workspace adoption** — keep the repo infra-only until the first real app feature is implemented.
   - Pros: smallest immediate diff, no scaffolding before code exists.
   - Cons: the first serious frontend/backend work would force a repo reshape at the same time as feature delivery; root tooling would be invented under pressure; `apps/web` and `apps/api` would still have no stable home.
   - Effort: Low

2. **Minimal pnpm apps-only workspace now** — adopt a boring workspace with `apps/web` and `apps/api`, shared root package management, and only the minimum common TypeScript/tooling config.
   - Pros: matches the ADR, removes future repo churn, gives both apps stable paths, keeps shared config centralized, avoids premature internal packages.
   - Cons: adds a little upfront scaffolding before business code exists.
   - Effort: Low

3. **Full monorepo platform now** — add `apps/*`, `packages/*`, shared libs, monorepo task runner, release tooling, and broader platform conventions immediately.
   - Pros: future-facing if the product grows fast.
   - Cons: overengineered for the current maturity, creates fake abstractions before duplication exists, and mixes workspace bootstrap with architectural decisions not yet validated.
   - Effort: Medium/High

### Recommendation
Use **Approach 2: minimal pnpm apps-only workspace now**.

Recommended minimum root foundation:
- `package.json`
  - `private: true`
  - `packageManager: pnpm@...`
  - `engines.node` for one supported Node line
  - only high-value root scripts such as install/lint/typecheck/dev helpers
- `pnpm-workspace.yaml`
  - include only `apps/*`
- `tsconfig.base.json`
  - shared compiler defaults only
- optional root `tsconfig.json`
  - solution/references file if the implementation wants `tsc -b` / editor coordination
- keep `.gitignore` aligned with Node workspace outputs when implementation starts

Recommended app foundation shape:

`apps/web`
- Next.js app scaffold only
- app-local `package.json`, `tsconfig.json`, framework config, and minimal `src/` entry structure
- no domain modules, auth flow, template workflows, or API clients yet

`apps/api`
- NestJS scaffold only
- app-local `package.json`, `tsconfig.json`, Nest bootstrap, and empty high-level folders prepared for routes/controllers, services/use-cases, and infrastructure adapters
- no business modules, persistence implementation, auth logic, or external-provider adapters yet

Recommended shared-boundary rule for current maturity:
- **Do not create `packages/` yet.**
- Share only root-level tooling/configuration, not runtime code.
- Keep web and api code isolated inside each app until real duplication appears.
- If a shared package is later justified, it should emerge from duplicated code proven across both apps, not from anticipation.

Recommended connection to current Makefile/Docker infra:
- keep `Makefile` as the operational entrypoint for PostgreSQL and Docker lifecycle
- keep Compose PostgreSQL-only for now; do **not** add app containers in this change
- let future `apps/api` and `apps/web` run directly via pnpm on the host while consuming the existing Dockerized DB
- only add Make wrappers for app commands if they provide real cross-tool value; do not mirror every pnpm script into Make prematurely

Implementation-ready scope for the next phase should therefore be:
- establish pnpm workspace root
- create `apps/web` and `apps/api` empty framework foundations
- wire minimal shared TypeScript defaults
- preserve the current DB/Compose contract unchanged except for documentation or script integration strictly needed by the workspace

What should remain explicitly out of scope:
- business/domain logic
- database schema, migrations, seeds, ORMs, or repositories
- Google OAuth, OpenRouter, OCR, storage adapters, Redis, BullMQ, workers
- shared runtime libraries/packages (`packages/ui`, `packages/shared`, SDKs, etc.)
- Turborepo/Nx/Changesets or other monorepo platform tooling
- app Dockerfiles, app Compose services, reverse proxy, CI/CD, or production deployment assets

### Risks
- If the repo stays single-package longer, the first real feature work will absorb unnecessary restructuring cost.
- If shared packages are introduced now, the project will lock in fake boundaries before duplication proves them.
- If Makefile and pnpm responsibilities are not kept clear, developer workflow will become noisy and redundant.
- If app runtimes are Dockerized too early, the current minimal local infra contract will sprawl before business code even exists.

### Ready for Proposal
Yes — the repo has enough evidence to propose a tightly-scoped workspace foundation centered on a **pnpm workspace with `apps/web` and `apps/api` only**, minimal root TypeScript/tooling config, and explicit preservation of the current PostgreSQL Make/Compose baseline.
