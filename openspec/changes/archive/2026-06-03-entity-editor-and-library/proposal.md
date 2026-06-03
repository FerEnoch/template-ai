# Proposal: Entity Editor & Template Library

## Intent

Enable users to edit extracted entities during review and browse saved templates. Address gaps: no entity value editing, broken Biblioteca nav, missing error handling, and no E2E coverage.

## Scope

### In Scope
- Entity edit modal (value, confidence, exclude)
- Template library page (`/biblioteca`, read-only)
- MSW error scenarios (500, failed, 409)
- Playwright E2E setup + critical path tests

### Out of Scope
- Template CRUD from library
- Backend API implementation
- Entity label editing

## Capabilities

### New
- `entity-editing`: In-place modal for entity value, confidence, and exclusion
- `template-library-page`: Read-only list of saved templates
- `e2e-testing`: Playwright config and test suite

### Modified
- `client-wizard-flow`: Entity rows trigger edit modal; review step shows inline errors
- `mock-service-layer`: `GET /api/templates`; error handlers; `PATCH` supports `excluded`
- `shared-contracts`: Entity schema adds `excluded` boolean

## Approach

Extend EntityInspector with click-to-edit rows. Reuse `UPDATE_ENTITY` wizard action. Add `excluded` to shared Entity schema. Create `/biblioteca` page with template cards. Wire sidebar link. Enhance MSW with error branches. Install Playwright and cover happy path, entity edit, errors, and library.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `apps/web/components/EntityInspector.tsx` | Modified | Clickable rows, modal trigger |
| `apps/web/app/review/page.tsx` | Modified | Error handling, inline errors |
| `apps/web/app/biblioteca/page.tsx` | New | Template list page |
| `apps/web/components/EntityEditModal.tsx` | New | Edit value/confidence/exclude |
| `packages/contracts/src/entity.ts` | Modified | Add `excluded` boolean |
| `apps/web/src/mocks/handlers.ts` | Modified | Error cases, GET templates |
| `apps/web/src/mocks/data/templates.ts` | New | Sample template fixtures |
| `apps/web/e2e/` | New | Playwright tests and config |
| `apps/web/package.json` | Modified | Add `@playwright/test` script |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Schema change breaks fixtures | Low | Update fixtures and MSW data |
| E2E flakiness in CI | Med | Use `webServer` config, retry-2 |

## Rollback Plan

Revert commit. `excluded` field is additive; removing it leaves entities valid. MSW changes are dev-only. Playwright is additive.

## Dependencies

- None

## Success Criteria

- [ ] Users can edit any entity's value and confidence
- [ ] Users can mark entities as excluded
- [ ] `/biblioteca` displays saved templates
- [ ] MSW returns errors for upload/analysis/save failures
- [ ] E2E tests pass locally
