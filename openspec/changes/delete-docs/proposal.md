# Proposal: Delete Generated Documents

## Intent

Replicate the template-deletion UX for generated documents on `/biblioteca`. Templates have Trash2 + `ConfirmDeleteDialog` + `DELETE /api/templates/:id` (soft-delete, `204`). The case list has no equivalent: `DELETE /api/cases/:id` → `archive()` exists but returns `200 + CaseResponse` and the UI has no trigger. This change adds the missing UI and aligns the contract to `204 + void`.

## Scope

### In Scope
- `DELETE /api/cases/:id` returns `204` (idempotent on already-archivado, `404` on missing)
- Trash2 on `CaseCard` (hover-visible, hidden when `case.status === "archivado"`)
- `ConfirmDeleteDialog` accepts generic `itemName` (replaces `templateName`)
- `biblioteca/page.tsx` wires `handleDeleteCase` + `handleDeleteCaseError`
- Vitest tests for the endpoint and new component logic

### Out of Scope
- Hard delete of `casos`, cascade to related tables, deleting from `/preview/[caseId]`
- Trash view, MSW mock for `DELETE /api/cases/:id`

## Capabilities

### New Capabilities
- `case-deletion`: Soft-delete contract for `casos` (`status='archivado'`, idempotent, `204`) plus the Trash2 + dialog UI.

### Modified Capabilities
- `template-library-page`: `/biblioteca` wires case deletion alongside template deletion. Template-display requirements unchanged.

## Approach

Backend: in `cases.controller.ts` set `@Delete(':id')` to `@HttpCode(204)` returning `void`; service stays `archive()`. Frontend: rename dialog prop `templateName` → `itemName`; add `Trash2` to `CaseCard` mirroring `TemplateCard` (hidden when archivado, `Loader2` while in-flight, inline error banner); wire `handleDeleteCase` + `handleDeleteCaseError` in `biblioteca/page.tsx`. Tests: service unit for `204`, controller integration for `404`, component Vitest for the new button + dialog.

## Affected Areas

| Area | Impact |
|------|--------|
| `apps/api/src/cases/cases.controller.ts` | `@HttpCode(204)` returning `void` |
| `apps/api/src/cases/__tests__/cases.controller.integration.spec.ts` | Assert `204` / `404` |
| `apps/web/src/components/biblioteca/ConfirmDeleteDialog.tsx` | Prop `templateName` → `itemName` |
| `apps/web/src/components/biblioteca/CaseList.tsx` | `CaseCard` adds Trash2 + dialog |
| `apps/web/src/components/biblioteca/TemplateCard.tsx` | Pass `itemName` |
| `apps/web/src/app/biblioteca/page.tsx` | Wire `handleDeleteCase`, `handleDeleteCaseError` |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Dialog prop rename breaks imports | Low | Internal; spec includes `grep` check |
| Hard-delete destroys audit trail | Low | Use `archive()` (soft-delete) — same as templates |
| `204` breaks pre-existing caller | Low | Only caller is the new frontend |

## Rollback Plan

Revert the commit. The dialog prop rename is internal; the `204` change is one line; reverting restores `200 + CaseResponse`. The `archive()` service, the `casos` table, and the data lifecycle are untouched.

## Dependencies

- `cases.service.archive()` (soft-delete via `status='archivado'`)
- `ConfirmDeleteDialog` (now generalized)
- Existing `biblioteca` page wiring

## Success Criteria

- [ ] `DELETE /api/cases/:id` returns `204` for existing, `404` for missing, idempotent on already-archivado
- [ ] Each case card shows a Trash2 button on hover (hidden when `archivado`); confirm calls `DELETE` and removes the card
- [ ] `pnpm --filter @template-ai/api test`, `pnpm --filter @template-ai/web test`, and `pnpm typecheck` all pass with new tests
