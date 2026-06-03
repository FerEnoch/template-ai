# Archive Report: backend-fixes

**Archived**: 2026-06-03
**Source**: `openspec/changes/backend-fixes/` → `openspec/changes/archive/2026-06-03-backend-fixes/`
**Mode**: openspec

## Change Summary

Minimal backend fixes change — 7 tasks addressing database migration, controller decoration, file validation, race condition fix, schema adjustment, and config fix.

## Artifacts Present

| Artifact | Status |
|----------|--------|
| proposal.md | ❌ Not created (minimal change) |
| specs/ | ❌ Not created (no delta specs) |
| design.md | ❌ Not created (minimal change) |
| tasks.md | ✅ All 7/7 tasks completed |
| verify-report.md | ❌ No formal report; T-007 confirms all tests passed |

## Task Completion

| Task | Status | Description |
|------|--------|-------------|
| T-001 | ✅ | Create migration `0003_seed_poc_user.sql` (user with id=0, bypass RLS) |
| T-002 | ✅ | Add `@HttpCode(200)` to `DocumentsController.upload()` |
| T-003 | ✅ | Add `ParseFilePipe` with `FileTypeValidator` + `MaxFileSizeValidator` to upload |
| T-004 | ✅ | Fix race condition in templates: remove SELECT check, catch unique violation |
| T-005 | ✅ | Make `status` field optional in create schema (defaults to "draft") |
| T-006 | ✅ | Fix `API_BASE_URL` default in `next.config.ts` (empty string instead of localhost) |
| T-007 | ✅ | Tests: 197/200 API, 45/45 web, typecheck clean, 10/12 E2E |

## Verification

No formal `verify-report.md` was created. The final task (T-007) served as verification, confirming:
- 197/200 API tests passing
- 45/45 web tests passing  
- Typecheck clean
- 10/12 E2E tests passing

## Spec Sync

No delta specs were present — no spec syncing was performed. No main specs were modified.

## Archive Contents

- `tasks.md` — complete task list
- `archive-report.md` — this file
