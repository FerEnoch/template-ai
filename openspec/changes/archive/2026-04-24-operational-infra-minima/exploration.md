## Exploration: operational-infra-minima

### Current State
This repository is still a docs-first workspace. There is no `Makefile`, no Docker Compose files, no app service containers, no `.env` files, and no test runner yet.

Existing architecture docs already fix the important constraints:
- dev, test, and prod MUST stay operationally separated
- Docker Compose is the local orchestration mechanism
- `Makefile` is the primary developer entrypoint
- PostgreSQL is the system of record and MUST NOT be shared between dev and test

That means the minimum operational infrastructure needed now is only the local database layer plus a thin command surface. Adding app containers, Redis, worker processes, or production deployment assets now would be premature.

### Affected Areas
- `docs/stack-technological-adr.md` — establishes Docker Compose by environment and `Makefile` as mandatory operational entrypoint
- `docs/postgresql-schema-draft.md` — requires explicit PostgreSQL isolation for dev/test/prod and forbids test/dev DB sharing
- `docs/prd-mvp-template-ai.md` — confirms the repo is still pre-implementation and should avoid exposing unnecessary infrastructure complexity early
- `openspec/changes/operational-infra-minima/exploration.md` — this exploration artifact

### Approaches
1. **Profiles-only Compose** — one compose file with `dev` and `test` profiles
   - Pros: single file, fewer filenames
   - Cons: environment concerns get mixed into one file, easy to start the wrong services, encourages optional-feature thinking instead of explicit environment boundaries, gets messy once app services appear
   - Effort: Low

2. **Separate Compose files per environment** — shared base plus `compose.dev.yaml` and `compose.test.yaml`
   - Pros: explicit environment separation, easy to wrap in `make`, clean future path to `compose.prod.yaml`, easier to review and maintain, matches current ADR wording
   - Cons: slight duplication in overrides, two-file compose invocation under the hood
   - Effort: Low

3. **Base Compose plus profiles and overrides** — use both now
   - Pros: flexible for future optional services
   - Cons: unnecessary complexity for a docs-only repo, too many moving parts before app services exist
   - Effort: Medium

### Recommendation
Use **Approach 2: separate Compose files per environment**, with a small shared base file.

Recommended files to exist **now**:
- `Makefile`
- `compose.yaml` — common PostgreSQL service baseline only
- `compose.dev.yaml` — dev-specific overrides
- `compose.test.yaml` — test-specific overrides
- `.env.dev.example`
- `.env.test.example`

Recommended files to defer **until later**:
- `compose.prod.yaml` — preserve the path, but do not implement production infra yet
- any `Dockerfile` for frontend/backend — blocked on actual app code
- Redis/BullMQ services — only when async workloads are real
- reverse proxy, observability stack, migrations container, seed container — only when application runtime exists
- CI/CD deployment workflow files — later design phase, once runtime packaging is defined

Recommended operational shape:
- `compose.yaml` contains one shared `postgres` service definition, healthcheck, and a single logical volume key
- `compose.dev.yaml` sets dev env file, dev port mapping, and dev-oriented persistence
- `compose.test.yaml` sets test env file, separate host port, and test-oriented lifecycle
- `Makefile` hides all compose flags and project names from developers

Recommended `make` command surface **now**:
- `make dev` — start dev database stack
- `make dev-down` — stop dev stack
- `make dev-logs` — follow dev DB logs
- `make dev-ps` — show dev stack status
- `make db-dev-shell` — open `psql` in dev DB container
- `make db-dev-reset` — recreate dev DB volume when needed
- `make test-db-up` — start isolated test DB stack
- `make test-db-down` — stop test DB stack
- `make test-db-logs` — follow test DB logs
- `make db-test-shell` — open `psql` in test DB container
- `make db-test-reset` — recreate test DB volume or disposable storage

`make test` should be reserved for the future automated test runner. If created now, it should fail clearly with an instructional message rather than pretending to run real tests.

Isolation rules that should be built in from day one:
- **Databases**: distinct DB names, e.g. `template_ai_dev` and `template_ai_test`
- **Env files**: `.env.dev` and `.env.test` locally, with tracked `.example` counterparts only
- **Ports**: dev on `5432`, test on `5433` when host exposure is needed
- **Volumes**: separate by Compose project name so test never reuses dev storage
- **Container names**: do **not** hardcode `container_name`; instead use distinct Compose project names from `make` such as `template_ai_dev` and `template_ai_test`
- **Networks**: inherit separation automatically from distinct Compose project names

For the test stack, default to a dedicated isolated volume now, but keep reset cheap. In CI or later automation, this can evolve into a truly ephemeral database without changing the developer-facing `make` surface.

Future app services that can be deferred without blocking current implementation:
- Next.js web service
- NestJS API service
- worker/queue service
- Redis
- object-storage emulator
- migration runner container

Those can all be added later as services layered onto the same env-specific compose structure. The current minimum blocker is only reliable local PostgreSQL separation and reproducible commands.

### Risks
- Using profiles instead of explicit env files will likely blur environment boundaries too early
- Hardcoding `container_name` can create collisions and removes Compose's built-in namespacing advantages
- Reusing one `.env` file across dev/test invites accidental cross-environment connections
- Binding both dev and test to host port `5432` makes concurrent use impossible
- Letting `make test` mean "bring up DB" would create misleading semantics once real tests arrive
- Adding prod infrastructure now would create churn because deployment targets are still undefined

### Ready for Proposal
Yes — the repo has enough evidence to propose a minimal operational change centered on `Makefile`, `compose.yaml` + env-specific overrides, and PostgreSQL isolation by Compose project name, env files, ports, and volumes.
