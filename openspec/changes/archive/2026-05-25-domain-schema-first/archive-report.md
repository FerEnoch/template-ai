# Archive Report: Domain Schema First

## Change
- **Name**: domain-schema-first
- **Artifact Store**: openspec (completed 2026-06-03)
- **Archived to**: `openspec/changes/archive/2026-05-25-domain-schema-first/`

## Specs Synced

| Domain | Action | Details |
|--------|--------|---------|
| account-ownership | Created | User identity anchor with strict single-tenant ownership boundary, RLS-enforced. |
| subscription-access | Created | Plan window + access state gating, exclusion constraint for non-overlapping active periods. |
| usage-ledger | Created | Append-only, fixed-unit consumption records with owner-scoped queries. |
| app-bootstrap-runtime | Updated | Preserved health/readiness guarantees alongside first domain persistence slice. |

## Archive Contents

- proposal.md ✅
- specs/account-ownership/spec.md ✅
- specs/subscription-access/spec.md ✅
- specs/usage-ledger/spec.md ✅
- specs/app-bootstrap-runtime/spec.md ✅
- design.md ✅
- tasks.md ✅ (12/12 tasks complete)
- verify-report.md ✅
- archive-report.md ✅ (this file, retroactive)

## Verification Summary

- **Tasks complete**: 12/12
- **Verdict**: PASS
- Migration `0001_domain_schema_first.sql`: 3 tables, `btree_gist`, generated columns, FK indexes, RLS policies, append-only trigger.
- Repositories: `users`, `subscriptions`, `usage-ledger` with owner-scoped transactions via `SET LOCAL app.current_user_id`.
- Integration tests: duplicate identity rejection, subscription overlap rejection, `units = 1`, append-only trigger, RLS isolation.
- Boundary tests: only `domain-schema-first` allowed; auth, templates, billing, documents rejected.

## Source of Truth Updated

- `openspec/specs/account-ownership/spec.md`
- `openspec/specs/subscription-access/spec.md`
- `openspec/specs/usage-ledger/spec.md`
- `openspec/specs/app-bootstrap-runtime/spec.md`

## Notes

- Archived retroactively on 2026-06-03. Original implementation completed 2026-05-25.
- First business-owned persistence slice: users, subscriptions, usage_ledger.
- Migration journal flow introduced (`db:migrate` explicit, never from `main.ts`).
- Report generated from existing verify-report.md and tasks.md audit.
