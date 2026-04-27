# Design: Local CI Smoke

## Technical Approach

Implement a **Make-first smoke entrypoint** (`make smoke`) that delegates ordered assertions and cleanup to `scripts/smoke-local.sh`. The script reuses existing `make dev`, `make test-db-up`, and `make db-test-reset` behavior (including current preflight and bounded readiness waits) and only adds thin verification/orchestration logic.

## Architecture Decisions

| Decision | Options | Tradeoffs | Choice |
|---|---|---|---|
| Smoke location | Pure Make; script-only; Make + script | Pure Make becomes unreadable for traps/state/SQL asserts; script-only breaks Make-first operator UX | **Make + tiny script** |
| Startup/readiness | Reimplement `docker compose up` + custom polling; call existing Make targets | Reimplementation duplicates logic and can drift from contract | **Call existing Make targets** |
| Isolation validation | Deep infra inspection; focused DB/port assertions | Deep inspection adds noise and brittleness | **Focused assertions only** |
| Reset validation | Reset both DBs; reset test only | Resetting dev violates contract and may destroy operator state | **Reset test only via `make db-test-reset`** |
| Cleanup behavior | Always down stacks; conditional down only if started by smoke | Always-down disrupts active local work | **Conditional cleanup with started-by-smoke flags** |

## Data Flow

```
make smoke
  └─ scripts/smoke-local.sh
      ├─ precheck: docker compose + .env.dev/.env.test
      ├─ start dev (make dev) if not already up
      ├─ start test (make test-db-up) if not already up
      ├─ verify contract (db name, ports, concurrent up)
      ├─ create sentinels in dev/test
      ├─ run make db-test-reset
      ├─ assert dev sentinel exists, test sentinel removed
      └─ trap cleanup: stop only stacks script started
```

## File Changes

| File | Action | Description |
|---|---|---|
| `Makefile` | Modify | Add `smoke` target and help text; keep `make` as public operator interface. |
| `scripts/smoke-local.sh` | Create | Sequential smoke orchestration, assertions, and selective cleanup trap. |
| `openspec/changes/local-ci-smoke/design.md` | Create | Technical design artifact for this change. |

## Interfaces / Contracts

```bash
# Public entrypoint
make smoke

# Behavior contract
- Exit 0: all smoke checks pass
- Exit non-zero: first failed prerequisite/assertion
- Never auto-create env files
- Never call dev reset
- May call test reset as part of verification
```

Script-level internal contract:
- Track booleans `STARTED_DEV` and `STARTED_TEST` based on pre-run stack status.
- Register `trap cleanup EXIT` immediately after initialization.
- `cleanup` runs `make dev-down` only when `STARTED_DEV=1`, and `make test-db-down` only when `STARTED_TEST=1`.

## Exact Check Sequence (and why)

1. **Prerequisites**: verify `docker compose` command and `.env.dev`/`.env.test` existence.  
   _Why_: fail fast, preserve explicit bootstrap policy.
2. **Baseline status snapshot**: detect whether dev/test stacks are already up.  
   _Why_: needed for non-destructive cleanup decisions.
3. **Start dev/test via Make targets** (`make dev`, `make test-db-up`) only when needed.  
   _Why_: reuse existing readiness timeout semantics.
4. **Isolation assertions**:
   - `current_database()` equals `template_ai_dev` (dev) and `template_ai_test` (test)
   - published host ports are `5432->5432` (dev) and `5433->5432` (test)
   - both stacks report running concurrently
   _Why_: verifies the required operational isolation contract.
5. **Reset-scope assertion**:
   - create minimal sentinel table+row in both DBs
   - run `make db-test-reset`
   - assert dev sentinel still present
   - assert test sentinel absent
   _Why_: proves reset is test-only with minimal SQL surface.
6. **Selective cleanup**: stop only stacks started by smoke.  
   _Why_: avoid tearing down operator-managed sessions.

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Smoke (local ops) | End-to-end contract checks above | Manual run `make smoke`; use non-zero exit as failure signal. |
| Unit/Integration/E2E app tests | N/A for this change | Out of scope by proposal; no app runtime introduced. |

## Migration / Rollout

No migration required. Rollout is immediate once `make smoke` and script are added.

## Tradeoffs and Rejected Alternatives

- **Rejected: pure Make smoke** — too hard to maintain with traps and conditional cleanup; increases recipe fragility.
- **Rejected: script-only public command** — less discoverable and inconsistent with existing Make-driven ops model.
- **Rejected: extensive SQL/infrastructure assertions** — higher maintenance for little extra confidence; minimal sentinels are enough for scope.
- **Rejected: unconditional teardown** — simpler implementation but unacceptable operator disruption risk.

## Open Questions

- [ ] None blocking this design.
