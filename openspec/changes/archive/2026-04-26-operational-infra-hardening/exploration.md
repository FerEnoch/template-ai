## Exploration: operational-infra-hardening

### Current State
The repository already has the local PostgreSQL baseline from `operational-infra-minima`: `Makefile`, `compose.yaml`, `compose.dev.yaml`, `compose.test.yaml`, `.env.dev.example`, `.env.test.example`, and `docs/local-operational-infra.md`.

What is still weak for day-to-day operator reliability:
- There is **no `.gitignore`** in the repo, so local env files created from the tracked examples would be easy to commit by accident.
- `compose.dev.yaml` and `compose.test.yaml` require `.env.dev` / `.env.test`; when those files are missing, Compose fails immediately. This was verified with `docker compose ... config`.
- `compose.yaml` has a PostgreSQL healthcheck, but `make dev`, `make test-db-up`, `make db-dev-reset`, and `make db-test-reset` only do `up -d`; they do **not** wait for readiness.
- Archived artifacts already recorded a transient post-reset readiness race in `postgres:16-alpine`, so the current contract is not deterministic enough for upcoming backend/frontend scaffolding.
- The image is pinned only to `postgres:16-alpine`, which is stable by major line but still floating at patch level.

### Affected Areas
- `.gitignore` — must protect local env files and minimal local operational leftovers from accidental commit.
- `Makefile` — needs env preflight/bootstrap wiring and a deterministic PostgreSQL wait step on start/reset targets.
- `compose.yaml` — likely needs tighter PostgreSQL image pinning while keeping the current healthcheck-based shape.
- `compose.dev.yaml` — currently hard-fails when `.env.dev` is absent.
- `compose.test.yaml` — currently hard-fails when `.env.test` is absent.
- `.env.dev.example` — should remain the bootstrap source of truth for dev env creation.
- `.env.test.example` — should remain the bootstrap source of truth for test env creation.
- `docs/local-operational-infra.md` — needs the minimal operator contract update for bootstrap and readiness behavior.

### Approaches
1. **Docs-only hardening** — add `.gitignore` and documentation, but keep runtime behavior as-is.
   - Pros: smallest diff, almost no implementation risk.
   - Cons: does not solve missing-env failures ergonomically, does not make DB startup deterministic, keeps patch drift risk in the image tag.
   - Effort: Low

2. **Explicit local infra hardening** — add a minimal `.gitignore`, explicit env preflight/bootstrap, deterministic DB wait in `Makefile`, patch-level PostgreSQL tag pinning, and one doc update.
   - Pros: fixes the actual operator contract, keeps scope tight, preserves current Compose structure, gives boring/reliable startup semantics for future app scaffolding.
   - Cons: adds a small amount of Makefile logic and one more documented workflow step.
   - Effort: Low

3. **Broader infra expansion** — use this moment to add CI, prod compose, migrations, app services, or ephemeral test orchestration.
   - Pros: more future-facing.
   - Cons: violates the requested scope, couples infra hardening with unrelated platform decisions, increases change risk without current need.
   - Effort: High

### Recommendation
Use **Approach 2: explicit local infra hardening**.

Minimum hardening to propose now:
- Add a **minimal `.gitignore`** for local env files used by this workflow (`.env.dev`, `.env.test`, and a narrow pattern strategy that keeps `*.example` tracked).
- Add **env preflight** before any Compose-backed target that depends on `.env.dev` or `.env.test`.
- Add **explicit bootstrap targets** (for example, one target per env or a single `env-init`) that copy from `.env.*.example` only when missing. Do **not** silently auto-create env files during `make dev`; failing with an actionable message is safer and more boring.
- Make `dev`, `test-db-up`, `db-dev-reset`, and `db-test-reset` **wait until PostgreSQL is actually reachable** before returning. Keep the Compose healthcheck, but do not rely on detached startup alone.
- **Pin PostgreSQL to an explicit patch-level Alpine tag**, not a floating major tag. For this phase, patch-level pinning is enough; digest pinning is unnecessary friction for a local-only baseline.
- Update `docs/local-operational-infra.md` just enough to document: env bootstrap, readiness/wait behavior, and the fact that reset commands also wait for DB readiness before returning.

Recommended wait strategy:
- Prefer an **explicit Makefile wait helper** that runs after `docker compose up -d` / reset and polls `pg_isready` with bounded retries.
- Keep the existing Compose `healthcheck` as container-level truth, but do not make operator UX depend on Compose version-specific features such as `up --wait`.
- This is the boring choice: clearer errors, better portability across local Docker Compose installs, and deterministic behavior after the known post-reset restart window.

Recommended env strategy:
- Bootstrap remains template-driven from `.env.dev.example` and `.env.test.example`.
- Preflight MUST fail early with a precise instruction when the required local env file is absent.
- Bootstrap target(s) MAY create the missing file(s), but only through an explicit operator action.

Recommended pinning degree:
- **Yes, pin now**.
- Pin to an **exact patch tag in the current major line and Alpine variant**.
- Do **not** introduce digest pinning yet; that level of rigidity is not justified for this local-only contract.

Explicitly out of scope for this hardening change:
- CI/CD pipelines or GitHub Actions.
- Monorepo/package scaffolding.
- Backend or frontend app services, Dockerfiles, or reverse proxies.
- Migrations, seed flows, schema changes, or business/domain logic.
- Redis, workers, queues, observability stacks, or production deployment assets.

### Risks
- If `.gitignore` is too broad, it may accidentally hide tracked example env files; the ignore rules must be narrow and explicit.
- If env bootstrap is implicit instead of explicit, operators may unknowingly work with placeholder credentials.
- If readiness uses detached startup without a real wait, upcoming app scaffolding will inherit flaky local boot behavior.
- If PostgreSQL stays on a floating major tag, local startup behavior may drift across machines over time.
- If this change expands into app/runtime infrastructure, the repo will mix baseline hardening with unrelated architectural decisions.

### Ready for Proposal
Yes — the repo has enough evidence to propose a tightly-scoped hardening change centered on `.gitignore`, explicit env preflight/bootstrap, deterministic PostgreSQL wait semantics in `Makefile`, patch-level PostgreSQL image pinning, and a minimal operator-doc update.
