# Design: Delete Generated Documents

## Technical Approach

Align the `casos` delete contract with the existing `templates` delete contract (`@HttpCode(204)` + `Promise<void>`, soft-delete via `archive()`), then mirror the `TemplateCard` UX on the case grid: a hover-visible `Trash2` button, the same `ConfirmDeleteDialog`, and inline error handling. The service layer (`cases.service.archive()`) and repository (`updateStatus`) already satisfy the spec's idempotency and 404 requirements — **no service or repository change is required**. All work is in the controller decorator (`204`) and the frontend components.

## Architecture Decisions

### Decision: Controller returns 204 + void (reuse existing service)

| Option | Tradeoff | Decision |
|---|---|---|
| Keep `200 + CaseResponse` | Frontend discards body, needs no payload | Rejected — diverges from templates contract |
| `@HttpCode(204)` + `void`, keep `archive()` | Service unchanged, matches templates, idempotent | Chosen |

**Rationale**: `archive()` already throws `NotFoundException` when `findById` returns null (drives `404`), and `findById` has no status exclusion so already-archivado cases are found and `updateStatus` succeeds (drives idempotent `204`). The service is correct as-is; only the controller decorator + return type change.

### Decision: Reuse `ConfirmDeleteDialog` via prop rename

| Option | Tradeoff | Decision |
|---|---|---|
| New `CaseDeleteDialog` | Duplicates component, drift risk | Rejected |
| Generalize prop `templateName` → `itemName` | Single shared component, internal rename | Chosen |

**Rationale**: The dialog is structural-only (title/body/actions). A single optional `itemKind` prop ("plantilla"/"caso") could keep localized copy, but spec mandates pure `itemName`, so copy strings move to callers. The rename is internal; `grep` guard in tasks ensures no stray `templateName`.

### Decision: Push dialog + delete state into `CaseList`/`CaseCard`

| Option | Tradeoff | Decision |
|---|---|---|
| Lift all deletion state to `page.tsx` | Page grows, per-card in-flight state awkward | Rejected |
| Local `useState` in each `CaseCard` (mirrors `TemplateCard`) | Per-card `isDeleting`/`deleteError`, page only owns list removal | Chosen |

**Rationale**: `TemplateCard` already owns `isDialogOpen/isDeleting/deleteError` and calls `onDelete(id)` on success, `onDeleteError()` on failure. `CaseCard` follows the same shape; `page.tsx` owns `handleDeleteCase` (filter list) and `handleDeleteCaseError` (refetch), exactly paralleling the template wiring.

## Data Flow

    User hover → CaseCard Trash2 (group-hover:opacity-100)
        │ click
        ▼
    ConfirmDeleteDialog (itemName) ── confirm ──► fetch DELETE /api/cases/:id
        │                                              │
        │                                              ▼
        │                                  CasesController @HttpCode(204)
        │                                              │ await archive()
        │                                              ▼
        │                                  CasesRepository.updateStatus('archivado')
        │
        ├─ ok      → setIsDialogOpen(false) → onDelete(id) → page filters cases[]
        └─ !ok     → setDeleteError(banner) → onDeleteError() → page refetch
                                                   (card stays in grid)

## File Changes

| File | Action | Description |
|---|---|---|
| `apps/api/src/cases/cases.controller.ts` | Modify | `@Delete(":id")` add `@HttpCode(204)`, return `Promise<void>` |
| `apps/api/src/cases/__tests__/cases.controller.integration.spec.ts` | Modify | Assert `204` (active + archivado) and `404` (missing) |
| `apps/web/src/components/biblioteca/ConfirmDeleteDialog.tsx` | Modify | Rename prop `templateName` → `itemName`; generalize copy |
| `apps/web/src/components/biblioteca/TemplateCard.tsx` | Modify | Pass `itemName={template.name}` |
| `apps/web/src/components/biblioteca/CaseList.tsx` | Modify | `CaseCard` gains `onDelete`/`onDeleteError` props, `Trash2` button (hidden when `archivado`), `Loader2` spinner, inline error banner, dialog |
| `apps/web/src/components/biblioteca/__tests__/*` | Create | Vitest for `CaseCard` button visibility/loading and dialog `itemName` |
| `apps/web/src/app/biblioteca/page.tsx` | Modify | Add `handleDeleteCase` + `handleDeleteCaseError`; pass to `CaseList` |

## Interfaces / Contracts

```ts
// ConfirmDeleteDialog — generalized
interface ConfirmDeleteDialogProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onConfirm: () => void;
  readonly isLoading: boolean;
  readonly itemName: string; // was: templateName
}

// CaseList — new callbacks (mirror TemplateGrid)
interface CaseListProps {
  readonly cases: Case[];
  readonly templates: Template[];
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly onRetry?: () => void;
  readonly onDelete?: (id: string) => void;       // NEW
  readonly onDeleteError?: () => void;            // NEW
}

// Controller
@Delete(":id")
@HttpCode(204)
public async archive(@Param("id") id: string): Promise<void> {
  await this.casesService.archive(0, id);
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Integration (api) | `DELETE /api/cases/:id` → `204` (active), `204` (idempotent archivado), `404` (missing) | Extend `cases.controller.integration.spec.ts` (DATABASE_URL-gated) |
| Unit (web) | `CaseCard` shows `Trash2` on active hover; hidden for `archivado`; `Loader2` + disabled while in-flight | RTL render + `userEvent`, assert `aria-label`/`title` presence |
| Unit (web) | Inline error banner renders on failure; card remains | Mock `fetch` rejection, assert banner text present |
| Unit (web) | `ConfirmDeleteDialog` uses `itemName` in title/body | RTL render with `itemName="Caso #3"` |
| Types | No stray `templateName` after rename | `pnpm typecheck` + grep guard task |

## Migration / Rollout

No migration required. The service/repository/table are untouched; only the HTTP status code (`200`→`204`) and frontend dialog prop change. The sole caller of `DELETE /api/cases/:id` is the new frontend. Rollback = revert the commit (one-line decorator, internal prop rename).

## Open Questions

- None blocking. Consider whether inline `itemName` copy should distinguish "caso" vs "plantilla" wording; spec mandates pure `itemName`, so left to callers (cases UI passes `"Caso #${id}"`-style names from `templateName`).