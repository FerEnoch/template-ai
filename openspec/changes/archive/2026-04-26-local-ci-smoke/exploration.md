## Exploration: local-ci-smoke

### Current State
This repository currently contains only the local PostgreSQL operational baseline: `Makefile` wrappers for dev/test stacks, exact PostgreSQL image pinning, explicit env bootstrap/preflight, and bounded readiness waits. There is no app/runtime code, no automated test runner, no `openspec/config.yaml`, and no active change folder yet for `local-ci-smoke`.

The source contract for local operations is `openspec/specs/local-operational-infra/spec.md`, backed by the archived `operational-infra-minima` and `operational-infra-hardening` changes. One important drift exists right now: `docs/local-operational-infra.md` is referenced by the main spec and archived verification artifacts, but the file is currently missing from the repository, so the operator contract lives mainly in `Makefile`, Compose files, and env examples.

### Affected Areas
- `Makefile` — natural public entrypoint for a future `make smoke` workflow.
- `compose.yaml` — shared PostgreSQL baseline already exercised by local operations.
- `compose.dev.yaml` — dev-specific env, port, and volume isolation that smoke should validate.
- `compose.test.yaml` — test-specific env, port, and volume isolation plus reset semantics that smoke should validate.
- `.env.dev.example` — documents expected dev database identity used by smoke assertions.
- `.env.test.example` — documents expected test database identity used by smoke assertions.
- `openspec/specs/local-operational-infra/spec.md` — defines the operational contract the smoke flow should verify.
- `docs/local-operational-infra.md` — currently missing; if restored later, likely the right place to document smoke semantics.
- `openspec/changes/local-ci-smoke/exploration.md` — this exploration artifact.

### Approaches
1. **Pure Make target** — keep all smoke logic inside `Makefile` recipes.
   - Pros: zero extra script files, consistent entrypoint, smallest visible diff.
   - Cons: traps, SQL assertions, conditional cleanup, and readable failure messages get ugly fast; harder to keep understandable.
   - Effort: Low

2. **Helper script only** — expose a standalone shell script as the smoke workflow.
   - Pros: easiest place for sequential assertions, state tracking, and cleanup traps.
   - Cons: bypasses the repo's `Makefile`-first operator contract and is less discoverable.
   - Effort: Low

3. **Make entrypoint + tiny helper script** — keep `make smoke` public and let a script execute the detailed checks.
   - Pros: preserves `make` as operator interface, keeps orchestration readable, supports deterministic setup/cleanup and focused SQL checks without inventing a test framework.
   - Cons: one extra script file to maintain.
   - Effort: Low

### Recommendation
Use **Approach 3: `make smoke` as the public command, delegating to a tiny helper script**.

Recommended minimum smoke flow:
1. Fail fast on prerequisites: `docker compose` available, `.env.dev` present, and `.env.test` present. Do **not** auto-create env files; keep bootstrap explicit via existing `make env-*` targets.
2. Start `make dev` and `make test-db-up`, reusing the existing readiness contract instead of duplicating wait logic.
3. Assert the minimum dev/test isolation contract with focused checks only:
   - `current_database()` resolves to `template_ai_dev` for dev and `template_ai_test` for test
   - host port mapping resolves to `5432` for dev and `5433` for test
   - both stacks can be up concurrently
4. Assert reset scope without building a general-purpose test framework:
   - create a sentinel table/row in dev
   - create a sentinel table/row in test
   - run `make db-test-reset`
   - verify the dev sentinel still exists
   - verify the test sentinel is gone after reset
5. Perform bounded cleanup of anything the smoke flow started itself; never reset dev as part of smoke.

Implementation shape should stay boring and minimal:
- `Makefile`: expose `smoke` (and optionally a lower-level script target alias).
- helper script: own the sequential assertions, temporary markers, and cleanup trap.
- SQL assertions: use `docker compose ... exec -T postgres psql ...` directly; no app code, no migration runner, no external test library.

Acceptable preconditions:
- Docker Engine plus Compose plugin available locally.
- `.env.dev` and `.env.test` already initialized; the operator may run `make env-init` explicitly beforehand.
- Host ports `5432` and `5433` available.
- The smoke command is allowed to reset the **test** database as part of validation; test is the disposable side of the contract.

What should remain out of scope:
- GitHub Actions, remote CI, or any hosted pipeline.
- Repurposing `make test`; it must stay reserved for the future automated test runner.
- App boot, domain logic, migrations, seeds, Redis, workers, reverse proxies, or broader platform verification.
- A generalized shell test framework or full integration test harness.

### Risks
- `docs/local-operational-infra.md` is currently missing even though the main spec and archived verification report assume it exists; smoke documentation may need to be reintroduced carefully.
- A pure-Make implementation will likely become opaque once it needs traps, SQL assertions, and conditional cleanup.
- If smoke tears down stacks unconditionally, it can disrupt an operator's current local session; cleanup should only revert what smoke started itself.
- If smoke starts verifying more than the local DB contract, scope will drift immediately.
- Resetting dev to prove isolation would violate the intended local contract; only test reset should be used as the destructive check.

### Ready for Proposal
Yes — the repo has enough evidence to propose a narrow local-only smoke command centered on existing Make/Compose PostgreSQL behavior, with deterministic env preflight, concurrent dev/test startup, and test-reset isolation checks.
