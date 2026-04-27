# Verification Report

**Change**: local-ci-smoke  
**Mode**: Standard  
**Artifact Store**: hybrid

---

## Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 13 |
| Tasks complete | 13 |
| Tasks incomplete | 0 |

All tasks in `openspec/changes/local-ci-smoke/tasks.md` are marked complete.

---

## Build & Tests Execution

**Build / type-check**: ➖ Not available  
`openspec/config.yaml` is not present, and cached testing capabilities for `template-ai` report no build or type-check command.

**Automated test runner**: ➖ Not available  
Cached testing capabilities (`sdd/template-ai/testing-capabilities`) show Strict TDD disabled and no test runner or coverage tooling configured for this repository.

**Runtime verification executed directly**:

| Check | Command | Result | Evidence |
|------|---------|--------|----------|
| Make help contract | `make help` | ✅ Passed | Help lists `make smoke` as the local PostgreSQL smoke command. |
| Helper shell validity | `bash -n scripts/smoke-local.sh` | ✅ Passed | Script parses successfully. |
| Compose availability | `docker compose version` | ✅ Passed | Docker Compose v5.1.2 available. |
| Missing env fail-fast + non-zero propagation | `python3 -c "... ./scripts/smoke-local.sh ..."` and `python3 -c "... make smoke ..."` with `.env.test` temporarily withheld | ✅ Passed | Helper exited `1`; `make smoke` exited `2`; both failed before startup, named `.env.test`, and printed explicit bootstrap guidance. |
| Smoke happy path | `make smoke` with transient `.env.test` materialized from `.env.test.example` and test stack already running | ✅ Passed | PASS summary after preflight, compose-config, startup/readiness, isolation, reset-scope, and cleanup. |
| Pre-existing test preserved | `make smoke` + `docker compose ... template_ai_test ps` | ✅ Passed | Test stack remained up after smoke because it was already running before the command. |
| Pre-existing dev preserved | `make dev && make smoke && docker compose ... template_ai_dev ps` | ✅ Passed | Dev remained available after smoke when it was already running before the command. |

**Coverage**: ➖ Not available

---

## Spec Compliance Matrix

| Requirement | Scenario | Evidence | Result |
|-------------|----------|----------|--------|
| Local smoke verification entrypoint | Missing env fails fast | With `.env.test` temporarily absent, both the helper and `make smoke` failed before startup, named `.env.test`, and pointed to `make env-test-init`. | ✅ COMPLIANT |
| Local smoke verification entrypoint | Helper script contract is preserved | `Makefile` delegates to repo-local `scripts/smoke-local.sh`, and when the helper failed, `make smoke` also exited non-zero (`2` vs helper `1`), matching the updated spec's GNU Make normalization caveat. | ✅ COMPLIANT |
| Smoke verifies the PostgreSQL local contract | Smoke passes on a valid local setup | `make smoke` validated compose pairing, DB identities (`template_ai_dev` / `template_ai_test`), ports (`5432` / `5433`), concurrent operation, and test-only reset semantics. | ✅ COMPLIANT |
| Smoke verifies the PostgreSQL local contract | Startup or contract verification fails clearly | Preflight failure output is proven directly; runtime assertion/readiness failure inside the smoke body was not induced in this pass, though `fail()` routes such checks to non-zero exit before cleanup completes. | ⚠️ PARTIAL |
| Smoke cleanup, output, and non-goals | Cleanup preserves pre-existing dev state | When dev was already running before smoke, it remained available after completion, and smoke only cleaned up resources it started itself. | ✅ COMPLIANT |
| Smoke cleanup, output, and non-goals | Scope remains local and minimal | `Makefile`, `docs/local-operational-infra.md`, proposal/design/spec artifacts, and repo contents keep smoke local-only with no hosted CI or broader platform scope. | ✅ COMPLIANT |

**Compliance summary**: 5/6 scenarios compliant, 1 partial

---

## Correctness (Static — Structural Evidence)

| Requirement | Status | Notes |
|------------|--------|-------|
| Local smoke verification entrypoint | ✅ Implemented | `make smoke` is the only public smoke entrypoint, delegates to repo-local `scripts/smoke-local.sh`, and propagates helper failure as a non-zero Make exit under the updated spec wording. |
| Smoke verifies the PostgreSQL local contract | ✅ Implemented | Script validates compose pairing, starts stacks via `make dev` / `make test-db-up`, checks DB identities and ports, and proves test-only reset with sentinels. |
| Smoke cleanup, output, and non-goals | ✅ Implemented | Immediate `trap cleanup EXIT`, `STARTED_DEV` / `STARTED_TEST` flags, phase logging, PASS/FAIL summary, and local-only docs match the requirement and design intent. |

---

## Coherence (Design)

| Decision | Followed? | Notes |
|----------|-----------|-------|
| Make + tiny script | ✅ Yes | `make smoke` remains public and delegates orchestration to `scripts/smoke-local.sh`. |
| Call existing Make targets for readiness | ✅ Yes | Script uses `make dev`, `make test-db-up`, and `make db-test-reset` rather than reimplementing readiness logic. |
| Focused DB/port assertions | ✅ Yes | Identity, port, concurrent-up, and sentinel checks stay narrow and aligned with the design. |
| Reset test only | ✅ Yes | Script never calls `make db-dev-reset`; reset validation uses `make db-test-reset` only. |
| Conditional cleanup with started-by-smoke flags | ✅ Yes | Verified with both pre-existing-test and pre-existing-dev runs. |

---

## Issues Found

**CRITICAL**
- None.

**WARNING**
- `openspec/changes/local-ci-smoke/tasks.md` still says task 1.2 should return the helper exit status unchanged, but the updated spec now intentionally requires only non-zero propagation because GNU Make may normalize failed recipe exits.
- No automated test runner or coverage tooling exists for this repository, so verification relied on direct runtime command execution instead of repeatable automated tests.
- This follow-up pass did not induce a readiness-timeout or isolation-mismatch failure inside the smoke body, so failure-path evidence remains partial beyond the preflight missing-env case.

**SUGGESTION**
- Add a deterministic smoke-failure harness so readiness and assertion failures can be exercised without temporary environment mutation.

---

## Verdict

**PASS WITH WARNINGS**

The previous CRITICAL exit-code contract mismatch is resolved under the updated spec: `make smoke` remains the public entrypoint, delegates to the helper, and propagates helper failure as non-zero even though GNU Make normalizes the exact code.
