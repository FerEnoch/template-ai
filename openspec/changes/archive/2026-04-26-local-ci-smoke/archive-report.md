# Archive Report: local-ci-smoke

## Change
- local-ci-smoke
- Artifact Store: hybrid
- Archived to: `openspec/changes/archive/2026-04-26-local-ci-smoke/`

## Specs Synced
| Domain | Action | Details |
|--------|--------|---------|
| local-operational-infra | Updated | Added the local smoke entrypoint, PostgreSQL contract verification, and cleanup/non-goals requirements to the source of truth. |

## Archive Contents
- proposal.md ✅
- specs/local-operational-infra/spec.md ✅
- design.md ✅
- tasks.md ✅
- verify-report.md ✅

## Verification Summary
- Tasks complete: 13/13
- Verdict: PASS WITH WARNINGS
- Runtime verification passed for Make help contract, shell syntax, compose availability, missing-env fail-fast, smoke happy path, and preservation of pre-existing dev/test state.
- Build/type-check tooling: not available.
- Automated test runner / coverage tooling: not available.

## Warnings Preserved
- Task/spec alignment drift: `tasks.md` still describes helper exit status as unchanged, while the updated spec intentionally only requires non-zero propagation because GNU Make may normalize failed recipe exits.
- Failure-path evidence is limited: this pass proved the missing-env preflight failure directly, but did not induce an internal readiness-timeout or isolation-mismatch failure inside the smoke body.
- No automated test runner or coverage tooling exists, so verification depends on direct runtime command execution.

## Source of Truth Updated
- `openspec/specs/local-operational-infra/spec.md`

## Notes
- Archived change after spec sync and verification with no critical issues.
