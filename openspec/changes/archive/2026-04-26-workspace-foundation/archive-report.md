# Archive Report: workspace-foundation

## Change
- workspace-foundation
- Artifact Store: hybrid
- Archived to: `openspec/changes/archive/2026-04-26-workspace-foundation/`

## Specs Synced
| Domain | Action | Details |
|--------|--------|---------|
| workspace-foundation | Created | Synced the completed delta spec into the source-of-truth `openspec/specs/workspace-foundation/spec.md`. |

## Archive Contents
- proposal.md ✅
- specs/workspace-foundation/spec.md ✅
- design.md ✅
- tasks.md ✅
- verify-report.md ✅

## Verification Summary
- Tasks complete: 14/14
- Verdict: PASS WITH WARNINGS
- Workspace contract passed: root package scope, fresh-bootstrap lint/typecheck, web/api bootstraps, and `make smoke`.
- No automated test runner or coverage tooling was available for this change.

## Warnings Preserved
- No automated test suite exists, so verification relied on direct command execution rather than repeatable tests.
- Verification ran under Node `v25.5.0` while the workspace declares `>=22 <23`; commands passed with engine warnings, but Node 22 LTS parity still needs confirmation.
- Running `pnpm --filter @template-ai/web dev` triggers Next.js 15 to rewrite `apps/web/tsconfig.json` and re-add `.next/types/**/*.ts`, so the bootstrap tsconfig can drift after dev startup.

## Source of Truth Updated
- `openspec/specs/workspace-foundation/spec.md`

## Notes
- Archived after syncing the delta spec and preserving the verification warnings.
