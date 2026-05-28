# Design: Entity Editor & Template Library

## Technical Approach

Extend the existing review step with a modal-based entity editor and add a read-only template library page. The approach reuses the existing `UPDATE_ENTITY` wizard action and `POST /api/review/:documentId/entities/:entityId` endpoint (extending its payload). MSW handlers are consolidated from the duplicated inline definitions in `msw-provider.tsx` into the canonical `handlers.ts`. Playwright is added as a dev dependency for E2E coverage.

## Architecture Decisions

| Decision | Options | Tradeoff | Choice |
|----------|---------|----------|--------|
| Modal implementation | (A) HTML `<dialog>` element, (B) Radix Dialog, (C) Custom div overlay | `<dialog>` is native, zero-dep, has built-in focus trap and backdrop. Radix adds 15KB. Custom div requires manual focus trap. | **A — native `<dialog>`** |
| Handler consolidation | (A) Import from `handlers.ts` into `msw-provider.tsx`, (B) Keep both, (C) Move all to `msw-provider.tsx` | (A) eliminates duplication. (B) is current broken state. (C) inverts the dependency. | **A — single source in `handlers.ts`** |
| Error scenario triggering | (A) URL query params (`?error=upload`), (B) MSW runtime overrides via `worker.use()`, (C) Cookie-based flags | (A) is simplest for E2E and manual testing. (B) requires test-only API. (C) is fragile. | **A — query params** |
| Biblioteca data fetching | (A) Client-side `fetch` in `"use client"` component, (B) Server component with `fetch` | (A) matches existing patterns (all pages are client). (B) is Next.js-idiomatic but inconsistent. | **A — client-side fetch** |
| Playwright MSW integration | (A) MSW runs in browser via service worker (already active in dev), (B) Playwright intercepts requests directly | (A) reuses existing mock layer — zero duplication. (B) requires parallel mock maintenance. | **A — MSW in browser** |

## Data Flow

### Entity Edit Flow

```
User clicks entity row
       │
       ▼
EntityInspector ──→ opens EntityEditModal (dialog.showModal())
       │
       ▼
User edits value / confidence / excluded ──→ clicks "Guardar"
       │
       ▼
Modal calls POST /api/review/:docId/entities/:entityId
  body: { value, confidence, excluded, reviewed: true }
       │
       ├── Success → dispatch UPDATE_ENTITY → close modal
       │
       └── Failure → inline error in modal, restore original value
```

### Template Library Flow

```
User navigates to /biblioteca
       │
       ▼
BibliotecaPage mounts → fetch GET /api/templates
       │
       ├── 200 + data → TemplateGrid → TemplateCard[]
       ├── 200 + []   → EmptyState component
       └── Error       → ErrorState with retry button
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `packages/contracts/src/schemas.ts` | Modify | Add `excluded: z.boolean().default(false)` to `EntitySchema` |
| `apps/web/src/components/wizard/EntityEditModal.tsx` | Create | Native `<dialog>` modal with value input, confidence toggle, exclude button |
| `apps/web/src/components/wizard/EntityInspector.tsx` | Modify | Make entity rows clickable `<button>` elements; open modal on click; dim excluded entities |
| `apps/web/src/components/wizard/index.ts` | Modify | Export `EntityEditModal` |
| `apps/web/src/app/review/page.tsx` | Modify | Extend `handleEntityUpdate` payload with `excluded`; add inline error state |
| `apps/web/src/app/biblioteca/page.tsx` | Create | Client page: fetch templates, render grid/empty/error states |
| `apps/web/src/components/shell/sidebar.tsx` | Modify | Change Biblioteca `href` from `"#"` to `"/biblioteca"` |
| `apps/web/src/mocks/handlers.ts` | Modify | Add `GET /api/templates`; extend entity POST to accept `excluded`; add error branches via query params |
| `apps/web/src/mocks/fixtures.ts` | Modify | Add `SAMPLE_TEMPLATES` array (3+ templates); add `excluded: false` to all entities |
| `apps/web/src/components/msw-provider.tsx` | Modify | Replace inline handlers with `import { handlers } from "@/mocks/handlers"` |
| `apps/web/package.json` | Modify | Add `@playwright/test` dev dep; add `test:e2e` script |
| `apps/web/playwright.config.ts` | Create | Playwright config: baseURL, webServer, testDir |
| `apps/web/e2e/wizard.spec.ts` | Create | Happy path + entity edit E2E tests |
| `apps/web/e2e/errors.spec.ts` | Create | Upload 500, analysis failed, save 409 tests |
| `apps/web/e2e/biblioteca.spec.ts` | Create | Empty state + template list tests |

## Interfaces / Contracts

```typescript
// EntityEditModal props
interface EntityEditModalProps {
  entity: Entity;
  open: boolean;
  onClose: () => void;
  onSave: (updated: Entity) => Promise<void>;
}

// Extended POST body for entity update
interface EntityUpdatePayload {
  value?: string;
  confidence?: "ALTA" | "MEDIA" | "BAJA";
  excluded?: boolean;
  reviewed?: boolean;
}

// Template list response (GET /api/templates)
type TemplateListResponse = Template[];
```

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | `EntitySchema` with `excluded` field | Vitest in `packages/contracts` — parse with/without excluded |
| Unit | `wizardReducer` UPDATE_ENTITY with excluded | Extend existing `wizardReducer.test.ts` |
| E2E | Happy path: upload → analysis → review → save | Playwright with MSW in browser |
| E2E | Entity edit: open modal, change value, confirm | Playwright click + fill + assert |
| E2E | Error scenarios: 500, failed, 409 | Navigate with `?error=upload` query param |
| E2E | Library: empty + populated states | Navigate to `/biblioteca`, assert cards |

## Migration / Rollout

No migration required. The `excluded` field defaults to `false` — all existing entities and fixtures remain valid without changes. MSW handler consolidation is internal refactoring with no external impact. Playwright is additive.

## Open Questions

- [ ] Should excluded entities be hidden by default in EntityInspector with a toggle to show them, or always visible with dimmed styling? (Spec says "filtered out by default" — leaning toward hidden with toggle)
- [ ] Should the confidence toggle in the modal be a 3-position segmented control or a cycling button? (Spec says "toggle" — segmented control is more discoverable)
