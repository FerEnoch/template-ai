# Proposal: Domain Schema First

## Intent

Bootstrap left `apps/api` with only technical runtime wiring. The next gap is the first business-owned persistence slice: who owns data, whether access is active, and how fixed MVP consumption is recorded. Starting with `users`, `subscriptions`, and `usage_ledger` creates the minimum domain spine before ingestion, templates, or generation.

## Scope

### In Scope
- PostgreSQL-first domain slice for `users`, `subscriptions`, and `usage_ledger`.
- NestJS persistence boundaries needed to read/write ownership, subscription state, and append-only usage records.
- Constraints/indexes aligned with the schema draft: normalized ownership, one active plan window path, append-only usage, and queryable access state.

### Out of Scope
- `source_documents`, analysis jobs/results, templates, cases, generated documents, exports, and `activity_events`.
- Google OAuth/provider adapters, billing engine complexity, quotas beyond fixed `1 unit` MVP rules, and full audit/event systems.
- Async jobs, seeds, vendor-specific columns, or broader product workflows.

## Capabilities

### New Capabilities
- `account-ownership`: persist the user identity anchor and strict single-tenant ownership boundary.
- `subscription-access`: persist plan window and access state required to gate future operations.
- `usage-ledger`: persist append-only, fixed-unit consumption records for analysis/generation accounting.

### Modified Capabilities
- `app-bootstrap-runtime`: preserve health/readiness and technical shell guarantees while allowing the first real domain persistence slice to exist beside bootstrap wiring.

## Approach

Use the frozen conceptual model and schema draft as the contract. Keep PostgreSQL as source of truth, model integrity in the schema first, and add only the minimal NestJS module/repository boundaries needed for this slice. This unlocks future ingestion and template work without dragging in auth integration or visible product workflows too early.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `openspec/changes/domain-schema-first/proposal.md` | New | Proposal for the first business slice |
| `openspec/changes/domain-schema-first/specs/` | New | Follow-up delta/new specs for this slice |
| `openspec/specs/app-bootstrap-runtime/spec.md` | Modified | Narrow bootstrap-only boundary where required |
| `apps/api/src/**` | Modified | Future minimal NestJS persistence boundaries for this slice |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Slice grows into product workflows | Med | Enforce explicit non-goals in specs |
| Auth/provider assumptions leak into schema | Med | Keep provider integration acknowledged but deferred |
| Usage/accounting becomes mutable or implicit | Low | Require append-only ledger and schema constraints |

## Rollback Plan

Revert this change’s schema/persistence artifacts and return `apps/api` to bootstrap-only runtime behavior with no domain tables or repositories.

## Dependencies

- `openspec/changes/domain-schema-first/exploration.md`
- `docs/domain-conceptual-model.md`
- `docs/postgresql-schema-draft.md`

## Success Criteria

- [ ] The change remains limited to `users`, `subscriptions`, and `usage_ledger`.
- [ ] Ownership, subscription state, and fixed-unit usage become persistable/queryable in PostgreSQL.
- [ ] The slice clearly enables next work on ingestion, templates, and generation without implementing them now.
