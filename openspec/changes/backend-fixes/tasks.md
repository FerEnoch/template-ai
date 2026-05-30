# Tasks: Backend Fixes

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Est. changed lines | ~150 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Delivery strategy | single-pr-default |

### Tasks

- [x] T-001 Create migration `0003_seed_poc_user.sql` (user with id=0, bypass RLS)
- [x] T-002 Add `@HttpCode(200)` to `DocumentsController.upload()`
- [x] T-003 Add `ParseFilePipe` with `FileTypeValidator` + `MaxFileSizeValidator` to upload
- [x] T-004 Fix race condition in templates: remove SELECT check, catch unique violation in repository
- [x] T-005 Make `status` field optional in create schema (defaults to "draft")
- [x] T-006 Fix `API_BASE_URL` default in `next.config.ts` (empty string instead of localhost)
- [x] T-007 Tests: 197/200 API, 45/45 web, typecheck clean, 10/12 E2E
