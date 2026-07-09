# Proposal: Inline Rename for Templates & Documents

## Intent

Users cannot rename templates or generated cases after creation. The biblioteca shows them with the original name assigned during the wizard, so any typo, vague label ("Contrato 1"), or post-generation naming desire (`"Contrato Pérez – Sept 2026"`) is permanent. This change adds **inline rename** — double-click a name in `/biblioteca` to edit, Enter or blur to save — for both template cards and generated-document cards.

## Scope

### In Scope
- `PATCH /api/templates/:id` accepting `{ name }` (Zod-validated, uniqueness-checked)
- `PATCH /api/cases/:id` extended to accept optional `name`
- Optional `name` column on `casos` table (nullable; null = fall back to template name)
- Reusable `EditableName` React component (display ↔ input state machine)
- Double-click trigger on `TemplateCard.name` and `CaseCard.name`
- Optimistic UI with rollback on PATCH error
- Spanish error messages matching existing tone ("Ya existe una plantilla llamada…")

### Out of Scope
- Bulk rename (multi-select)
- Rename on the wizard, review, preview, or save pages
- Renaming the underlying `templateId` on a case (immutable FK)
- Versioning / rename history
- Server-side keyboard shortcuts, drag-to-edit
- Auto-rename suggestions (AI)

## Capabilities

> Contract for `sdd-spec`. New capabilities become `openspec/specs/<name>/spec.md`.

### New Capabilities
- `inline-name-editing`: Reusable React component + state machine for inline-editable text (double-click to edit, Enter/blur to save, Escape to cancel, loading state, error rollback). Reused by both template and case cards.

### Modified Capabilities
- `template-library-page`: Template cards in `/biblioteca` MUST expose inline rename on the name. Library spec gains a "Rename Template" requirement.
- `case-management`: PATCH `/api/cases/:id` MUST accept `{ name }`. `CaseSchema` gains optional `name: string | null`. Display rule: show `case.name ?? template.name`.
- `shared-contracts`: Add `UpdateTemplateNameSchema`, extend `UpdateCaseFormDataSchema` with optional `name`, add `name` to `CaseSchema`.

## Approach

**Backend**: New `updateName` method on `TemplatesRepository` (UPDATE templates SET name = $1 WHERE id = $2) reusing the existing `isUniqueViolation` pattern from `TemplatesService.create` to convert PG 23505 into `ConflictException`. New `updateName` on `CasesRepository` (no uniqueness constraint on cases). New `templates.controller.update` PATCH handler with `UpdateTemplateNameSchema` body. Extend `cases.controller.update` to read the new optional `name` field. Migration `0011_casos_name.sql` adds nullable `name TEXT` to `casos`. No RLS changes — RLS already enforces per-user access on both tables.

**Frontend**: New `EditableName` component (controlled input with `useTransition` for save, `useRef` for focus + select-all on mount, `onBlur` + `onKeyDown` handlers). Wraps the existing `<h3>` text in `TemplateCard` and `CaseCard`. `stopPropagation` on the input wrapper to prevent the surrounding `<Link>` from triggering. Optimistic update on Enter/blur; revert on PATCH failure with a toast-like inline error. Empty/whitespace names rejected client-side before the request. `useTransition` keeps the input responsive while the request is in flight (per Vercel `rerender-transitions`).

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `packages/contracts/src/schemas.ts` | Modified | Add `name?` to `CaseSchema`; add `UpdateTemplateNameSchema`; extend `UpdateCaseFormDataSchema` |
| `packages/contracts/src/index.ts` | Modified | Re-export new schemas and types |
| `apps/api/src/infrastructure/postgres/migrations/0011_casos_name.sql` | New | `ALTER TABLE casos ADD COLUMN name TEXT` (nullable) |
| `apps/api/src/templates/templates.controller.ts` | Modified | Add `@Patch(':id')` handler |
| `apps/api/src/templates/templates.service.ts` | Modified | Add `updateName` with uniqueness check |
| `apps/api/src/infrastructure/postgres/repositories/templates.repository.ts` | Modified | Add `updateName(id, name)` |
| `apps/api/src/cases/cases.controller.ts` | Modified | Accept optional `name` in PATCH body |
| `apps/api/src/cases/cases.service.ts` | Modified | Add `updateName`; pass through to repository |
| `apps/api/src/infrastructure/postgres/repositories/cases.repository.ts` | Modified | Add `updateName`; include `name` in `CASE_SELECT` |
| `apps/web/src/components/biblioteca/EditableName.tsx` | New | Reusable inline-rename component |
| `apps/web/src/components/biblioteca/TemplateCard.tsx` | Modified | Wrap `<h3>` in `EditableName` |
| `apps/web/src/components/biblioteca/CaseList.tsx` | Modified | Use `case.name ?? template.name`; wrap in `EditableName` |
| `apps/web/src/app/biblioteca/page.tsx` | Modified | Thread `onRename` callbacks to update local state |
| `apps/web/src/lib/api/templates.ts`, `apps/web/src/lib/api/cases.ts` | New/Modified | `updateName` wrappers |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Click on the name input triggers the surrounding card `<Link>` | Med | `e.stopPropagation()` + `preventDefault` on the input wrapper; verify with Playwright |
| Optimistic update leaves UI in inconsistent state on network error | Med | Roll back local state on PATCH failure; show inline error with retry; verify in Vitest |
| Template name unique-constraint violation on concurrent edits | Low | Reuse existing `isUniqueViolation` (PG 23505) → 409; mirror the create flow's error message |
| Double-click on the card body accidentally enters edit mode | Low | Trigger only on the `<h3>` element, not the whole card; document in component |
| Renaming a template confuses users who set a custom case name | Low | Case custom name takes precedence; rename never silently overwrites; documented in UI helper text |
| Migration 0011 on production with existing rows | Low | Column is nullable with no default; no backfill; old cases display `template.name` as before |

## Rollback Plan

1. **API**: Revert commits that added `updateName` to controllers/services/repositories. Remove the `templates.controller.update` PATCH handler. The `name` column is left in place (nullable, unused) — no schema change needed for revert.
2. **Web**: Revert `EditableName.tsx` and the `TemplateCard` / `CaseList` changes. Cards revert to static `<h3>`.
3. **Migration**: If desired, run `ALTER TABLE casos DROP COLUMN name` (safe — no code references it). Otherwise leave the column; it's inert.
4. **No data loss** at any stage. Existing case/template names are never modified by the new code.

## Dependencies

- None external. Reuses existing `isUniqueViolation` helper, `ConflictException`, `PostgresService.withOwnerTransaction`, RLS policies.

## Success Criteria

- [ ] User can double-click a template name on `/biblioteca` and edit it inline
- [ ] Pressing Enter or clicking away saves the new name; Escape cancels
- [ ] Same flow works on a generated-document (case) card
- [ ] Empty or whitespace-only names are rejected with an inline error
- [ ] Renaming a template to an existing name returns 409 with a Spanish error message
- [ ] Optimistic update reverts on PATCH failure; user sees the error inline
- [ ] Renaming a template does NOT overwrite any custom case name (case `name` takes precedence)
- [ ] PATCH endpoints respect RLS — cross-user rename returns 404/401
- [ ] Vitest unit tests cover `EditableName` state machine; integration tests cover both PATCH endpoints
- [ ] Playwright E2E covers the happy path (rename template, rename case, cancel with Escape, error rollback)
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm format`, `pnpm --filter @template-ai/web test`, `pnpm --filter @template-ai/api test` all pass
- [ ] No regression in existing library, wizard, preview, or export flows
