# Design: Inline Rename for Templates & Documents

## Technical Approach

Extend the existing Ports & Adapters NestJS backend with `updateName` repository methods and PATCH handlers, and add a reusable `EditableName` React component wrapping the card `<h3>`. The backend reuses the proven `isUniqueViolation` → `ConflictException` pattern from `TemplatesService.create`; the frontend reuses the `ApiError`/`safeFetch` infrastructure in `lib/api/*` and adds a `useTransition`-driven state machine (per Vercel `rerender-transitions`). A single nullable `name` column on `casos` (migration `0011`) unlocks independent case rename with `case.name ?? template.name` fallback.

## Architecture Decisions

### Decision: Uniqueness via DB constraint, not SELECT-then-UPDATE

| Option | Tradeoff | Decision |
|--------|----------|----------|
| `findByNameAndUserId` then update | TOCTOU race under concurrent rename | ❌ Rejected |
| `UPDATE … WHERE name NOT IN (…)` | Complex SQL, partial coverage | ❌ Rejected |
| `UPDATE … RETURNING` + catch PG 23505 | Mirrors `create` flow, atomic | ✅ Chosen |

**Rationale**: `templates.repository.updateName` runs `UPDATE templates SET name=$1 WHERE id=$2 RETURNING …`. The existing `UNIQUE (user_id, name)` constraint (migration 0002) raises 23505 on duplicates; `TemplatesService.updateName` catches it and throws `ConflictException` with the Spanish message format already used by `create`. No new SQL constraint needed.

### Decision: Cases display name via embedded `template`, separate `templates[]` unchanged

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Use embedded `case.template.name` (CaseWithTemplate) | API already returns it; drop `templates[]` | ❌ Rejected (large page refactor, out of scope) |
| Add `name` to `CaseSchema`; keep `resolveTemplateName` | Minimal UI churn; backward-compat | ✅ Chosen |

**Rationale**: `/biblioteca` page already passes `templates: Template[]` to `CaseList` and resolves via `resolveTemplateName`. We add `name` (nullable) to `CaseSchema` + `CaseRecord` + `CaseResponse`, and the display becomes `case.name ?? templateName`. No change to the page's data-fetching shape.

### Decision: `EditableName` uses `useTransition` + `useRef`

| Option | Tradeoff | Decision |
|--------|----------|----------|
| `useState` only | Input freezes during PATCH (synchronous) | ❌ Rejected |
| `useTransition` for save + `useRef` for focus/select-all | Input stays responsive; matches Vercel `rerender-transitions`, `rerender-use-ref-transient-values` | ✅ Chosen |

**Rationale**: `startTransition` wraps the optimistic state write + `onSave` await, so the input remains editable while the PATCH is in-flight. `useRef` focuses and selects the text on entering edit mode (non-state, frequent value → ref, per `rerender-use-ref-transient-values`).

## Data Flow

```
TemplateCard/CaseCard
   └─ <h3> wrapped by <EditableName>
        ├─ display state (double-click → edit)
        ├─ edit state (Enter/blur → save; Escape → cancel)
        └─ onSave(name) ─→ optimistic local state write (useTransition)
                          └→ PATCH /api/templates/:id | /api/cases/:id
                                ├─ 200 → confirm
                                ├─ 409 → rollback + inline error (Spanish)
                                └─ other → rollback + ApiError message
```

`stopPropagation()` + `preventDefault()` on the input wrapper isolate the click from the surrounding `<Link>` (`TemplateCard` uses `<Link href=...>`, `CaseCard` uses `<Link href=...>`).

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `packages/contracts/src/schemas.ts` | Modify | Add `UpdateTemplateNameSchema`; add `name?: string\|null` to `CaseSchema`; add optional `name` to `UpdateCaseFormDataSchema`; export types |
| `packages/contracts/src/index.ts` | Modify | Re-export `UpdateTemplateNameSchema`, `UpdateTemplateName` |
| `apps/api/src/infrastructure/postgres/migrations/0011_casos_name.sql` | New | `ALTER TABLE casos ADD COLUMN IF NOT EXISTS name TEXT` (nullable, no default). No RLS changes |
| `apps/api/src/templates/templates.controller.ts` | Modify | Add `@Patch(':id')` handler validating `UpdateTemplateNameSchema`; return `TemplateResponse` |
| `apps/api/src/templates/templates.service.ts` | Modify | Add `updateName(userId, id, name)` with `isUniqueViolation` → `ConflictException`; `findById` check → `NotFoundException` |
| `apps/api/src/infrastructure/postgres/repositories/templates.repository.ts` | Modify | Add `updateName(id, name): Promise<TemplateRecord \| null>` using `UPDATE … RETURNING` |
| `apps/api/src/cases/cases.controller.ts` | Modify | Route optional `name` from `UpdateCaseFormDataSchema` to `casesService.updateName` when status FormData absent |
| `apps/api/src/cases/cases.service.ts` | Modify | Add `updateName(userId, id, name)`; pass null through to repo. Add `name` to `CaseResponse` + `mapToResponse` |
| `apps/api/src/infrastructure/postgres/repositories/cases.repository.ts` | Modify | Add `c.name` to `CASE_SELECT`; add `name` to `CaseRecord` + `rowToCase`; add `updateName(id, name)` |
| `apps/web/src/components/biblioteca/EditableName.tsx` | New | Reusable inline-rename component (state machine + `useTransition` + `useRef`) |
| `apps/web/src/components/biblioteca/TemplateCard.tsx` | Modify | Wrap `<h3>{template.name}</h3>` in `<EditableName>`; thread `onRename` |
| `apps/web/src/components/biblioteca/CaseList.tsx` | Modify | Display `case.name ?? templateName`; wrap in `<EditableName>`; thread `onRename` |
| `apps/web/src/lib/api/templates.ts` | New | `updateTemplateName(id, name)` wrapper (mirrors `cases.ts` `ApiError`/`safeFetch`) |
| `apps/web/src/lib/api/cases.ts` | Modify | Extend `updateCase` to send optional `name` |
| `apps/web/src/app/biblioteca/page.tsx` | Modify | Add `onRenameTemplate` / `onRenameCase` callbacks updating local `templates`/`cases` state |

## Interfaces / Contracts

```ts
// packages/contracts/src/schemas.ts
export const UpdateTemplateNameSchema = z.object({
  name: z.string().trim().min(3).max(200),
});
export type UpdateTemplateName = z.infer<typeof UpdateTemplateNameSchema>;

// CaseSchema extension
name: z.string().max(200).nullable().optional(),

// UpdateCaseFormDataSchema extension
name: z.string().trim().max(200).nullable().optional(),
```

```tsx
// EditableName.tsx — public API
interface EditableNameProps {
  readonly value: string;
  readonly onSave: (name: string) => Promise<void>; // throws to signal error → rollback
  readonly displayClassName?: string;
  readonly inputClassName?: string;
  readonly maxLength?: number; // default 200
}
```

The component manages its own state machine (`display | edit | loading | error`) and calls `onSave`; a rejection (thrown error) triggers rollback + inline error message. Parent owns the optimistic state update.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit (contracts) | `UpdateTemplateNameSchema` rejects empty/whitespace/oversized; `CaseSchema` accepts optional nullable `name`; backward-compat without `name` | Vitest in `packages/contracts` |
| Unit (api) | `TemplatesService.updateName` maps 23505 → `ConflictException`, missing → `NotFoundException`; `CasesService.updateName` passes null through | Vitest service specs |
| Integration (api) | `PATCH /api/templates/:id` happy + 409 duplicate + 404; `PATCH /api/cases/:id` with `name` happy + 404 cross-user (RLS) | Vitest + supertest, guarded by `DATABASE_URL` (mirrors existing template integration spec) |
| Unit (web) | `EditableName` state machine: double-click→edit, Enter→onSave, Escape→cancel, empty→inline error, onSave throw→rollback; click isolation via event spy | Vitest + Testing Library |
| E2E (Playwright) | Rename template, rename case, cancel with Escape, error rollback (force 409 via pre-existing name) | Existing Playwright setup |

## Migration / Rollout

Migration `0011_casos_name.sql` adds nullable `name TEXT` with no default and no backfill — existing rows get `null`, so they keep displaying `template.name`. No RLS change (existing `casos_update` policy covers the new column). Feature ships behind no flag; revert per proposal's Rollback Plan leaves the column inert.

## Open Questions

- [ ] Should `PATCH /api/templates/:id` also reject renaming an `archived` template? (Current proposal is silent; design assumes archived templates are not shown on `/biblioteca`, so unreachable. Confirm in tasks.)
- [ ] Should renaming via `PATCH /api/cases/:id` be blocked for `archivado` cases (mirroring `updateFormData`)? (Spec allows rename on any owner; design assumes yes-rename allowed even on archived. Confirm.)