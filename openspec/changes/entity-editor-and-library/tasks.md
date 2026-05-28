# Tasks: Entity Editor & Template Library

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~930–1010 |
| 800-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2 → PR 3 → PR 4 |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
800-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Contracts + MSW refactor + fixtures + handlers | PR 1 | Test-first; base = main; ~320 lines |
| 2 | EntityEditModal + EntityInspector + review page | PR 2 | Depends on PR 1; base = main; ~210 lines |
| 3 | Biblioteca page + TemplateCard/Grid + sidebar | PR 3 | Parallel to PR 2; base = main; ~140 lines |
| 4 | Playwright config + E2E tests | PR 4 | Depends on PR 2+3; base = main; ~300 lines |

## Phase 1: Foundation (test-first, sequential; parallel to Phase 4)

- [x] 1.1 Add `excluded: z.boolean().default(false)` to `EntitySchema` in `packages/contracts/src/schemas.ts`
- [x] 1.2 Write unit test: EntitySchema parses with/without excluded, defaults to false
- [x] 1.3 Add `excluded: false` to all entities in `apps/web/src/mocks/fixtures.ts`; add `SAMPLE_TEMPLATES` (3+)
- [x] 1.4 Refactor `apps/web/src/components/msw-provider.tsx` → import handlers from `@/mocks/handlers`; delete inline
- [x] 1.5 Add `GET /api/templates` + error branches (500/failed/409 via `x-mock-error` headers) to `handlers.ts`
- [x] 1.6 Extend `POST /api/review/:docId/entities/:entityId` in `handlers.ts` to accept `excluded` field
- [x] 1.7 Write unit test for handlers — GET templates shape, error branches trigger correctly

## Phase 2: Entity Editing (depends on Phase 1; parallel to Phase 3)

- [ ] 2.1 Create `apps/web/src/components/wizard/EntityEditModal.tsx` — native `<dialog>`, value input, confidence toggle, Excluir/Restaurar button
- [ ] 2.2 Make entity rows clickable `<button>` in `EntityInspector.tsx`; dim excluded entities; open modal on click
- [ ] 2.3 Export `EntityEditModal` from `components/wizard/index.ts`
- [ ] 2.4 Extend `handleEntityUpdate` in `review/page.tsx` with `excluded` payload + inline error state
- [ ] 2.5 Write unit test for EntityEditModal — renders, value edit, exclude toggle, error on API fail

## Phase 3: Template Library (depends on Phase 1; parallel to Phase 2)

- [ ] 3.1 Create `apps/web/src/components/biblioteca/TemplateCard.tsx` — name, category, date, entity count
- [ ] 3.2 Create `apps/web/src/components/biblioteca/TemplateGrid.tsx` — grid with loading/empty/error states
- [ ] 3.3 Create `apps/web/src/app/biblioteca/page.tsx` — client fetch `GET /api/templates`, render grid/empty/error
- [ ] 3.4 Change sidebar "Biblioteca" href from `"#"` to `"/biblioteca"` in `sidebar.tsx`

## Phase 4: E2E Infrastructure (parallel to all)

- [ ] 4.1 Add `@playwright/test` dev dep + `test:e2e` script to `apps/web/package.json`
- [ ] 4.2 Create `apps/web/playwright.config.ts` — baseURL, webServer, testDir

## Phase 5: E2E Tests (depends on Phase 2 + 3 + 4)

- [ ] 5.1 Create `apps/web/e2e/wizard.spec.ts` — full happy path + entity edit (modal open, value change, exclude)
- [ ] 5.2 Create `apps/web/e2e/errors.spec.ts` — upload 500, analysis failed, save 409 error displays
- [ ] 5.3 Create `apps/web/e2e/biblioteca.spec.ts` — empty state + template card list
