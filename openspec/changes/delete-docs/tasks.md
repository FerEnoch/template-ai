# Tasks: Delete Generated Documents

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~210 (controller 5 + dialog 12 + CaseCard 80 + page 12 + tests 100) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | single PR |
| Delivery strategy | single-pr-default |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Backend 204 + dialog rename + CaseCard UX + page wiring in one PR | PR 1 | Diff under 400 lines; tests included with each behavior |

## Phase 1: Backend — DELETE returns 204

- [ ] 1.1 RED: extend `apps/api/src/cases/__tests__/cases.controller.integration.spec.ts` `DELETE /api/cases/:id` block — assert 204 on active case, 204 on archivado, 404 on missing.
- [ ] 1.2 GREEN: in `apps/api/src/cases/cases.controller.ts`, add `@HttpCode(204)` to `@Delete(":id")` and change return type to `Promise<void>`.
- [ ] 1.3 Verify: `pnpm --filter @template-ai/api test` green.

## Phase 2: Frontend — Generalize ConfirmDeleteDialog

- [ ] 2.1 RED: create `apps/web/src/components/biblioteca/__tests__/ConfirmDeleteDialog.test.tsx` asserting title and body reference the `itemName` prop.
- [ ] 2.2 GREEN: in `ConfirmDeleteDialog.tsx`, rename prop `templateName` → `itemName`, drop hardcoded "plantilla" from title/body copy.
- [ ] 2.3 Update `TemplateCard.tsx` and `app/biblioteca/[id]/page.tsx` to pass `itemName={template.name}`.
- [ ] 2.4 Verify: `pnpm --filter @template-ai/web test` green; `grep -r "templateName" apps/web/src/components/biblioteca apps/web/src/app/biblioteca` returns no matches.

## Phase 3: Frontend — CaseCard delete UX

- [ ] 3.1 RED: create `apps/web/src/components/biblioteca/__tests__/CaseCard.test.tsx` asserting: Trash2 hidden when `status==='archivado'`, visible on hover for active, `Loader2` + disabled when `isDeleting`, inline error banner on fetch failure, `onDelete(id)` on success, dialog opens on click and `onConfirm` fires the DELETE.
- [ ] 3.2 GREEN: in `CaseList.tsx`, convert `CaseCard` to own `isDialogOpen`/`isDeleting`/`deleteError` state, fetch `DELETE /api/cases/${caseData.id}`, render `ConfirmDeleteDialog` with `itemName={templateName}`, call `onDelete`/`onDeleteError`.
- [ ] 3.3 Refactor: ensure `e.preventDefault()` + `e.stopPropagation()` on Trash2 click so the wrapping `Link` does not navigate; keep card markup stable for `isLoading`/`Empty`/`Error` paths.

## Phase 4: Frontend — biblioteca page wiring

- [ ] 4.1 In `CaseList.tsx`, add optional `onDelete`/`onDeleteError` to `CaseListProps`; forward to each `CaseCard`.
- [ ] 4.2 In `app/biblioteca/page.tsx`, add `handleDeleteCase` (filter `cases` by id) and `handleDeleteCaseError` (call `fetchCases`); pass both to `CaseList`.

## Phase 5: Verification

- [x] 5.1 `pnpm typecheck` (root) green.
- [x] 5.2 `pnpm --filter @template-ai/api test` and `pnpm --filter @template-ai/web test` both green.
- [x] 5.3 `grep -r "templateName" apps/web/src/components/biblioteca apps/web/src/app/biblioteca` returns no matches.
