# Design: Hover-to-Highlight Entity Inspector ↔ Preview

## Technical Approach

Lift transient hover state into `ReviewInner` (the common parent that renders both the document preview and `EntityInspector`). Pass `hoveredEntityId` down to `renderHighlightedText` via a new options parameter, and pass `onEntityHover` callback to `EntityInspector`. Pure React state — no context, no store, no persistence. The `<mark>` matching the hovered entity ID gets elevated Tailwind opacity/border classes; all others remain unchanged.

## Architecture Decisions

| Decision | Options | Tradeoff | Choice |
|----------|---------|----------|--------|
| State ownership | (A) `useState` in ReviewInner, (B) WizardContext, (C) Zustand slice | A = minimal, colocated; B/C = over-engineered for transient UI | **A — `useState<string \| null>(null)` in ReviewInner** |
| `renderHighlightedText` API | (A) flat 3rd param `hoveredEntityId?: string \| null`, (B) options object `{ hoveredEntityId }` | A = simpler now; B = extensible, matches spec contract | **B — options object** (spec mandates `{ hoveredEntityId }`) |
| Hover fires on which rows | (A) only rows with `sourceSpan`, (B) all visible rows | A = less noise; B = spec requires ALL rows including excluded and no-sourceSpan | **B — all entity row `<button>` elements** |
| Priority section hover | (A) add hover to priority `<div>` rows, (B) skip — same entities appear in groups | A = consistent; B = avoids duplicate handlers, priority items are `<div>` not `<button>` | **B — skip priority section** (entities duplicated in group section) |
| Elevated CSS classes | (A) `bg-success/30`, (B) `bg-success/35 border-success` | A = subtler; B = matches spec, more visible border change | **B — `/35` bg + full-opacity border** |

## Data Flow

```
ReviewInner (owns hoveredEntityId state)
├── EntityInspector
│     onEntityHover(id) ──→ setHoveredEntityId(id)
│     onEntityHover(null) ──→ setHoveredEntityId(null)
│
└── renderHighlightedText(text, entities, { hoveredEntityId })
      └── <mark> with elevated class when entity.id === hoveredEntityId
```

Single-direction data flow: EntityInspector emits hover events up, ReviewInner stores the ID, passes it down to the render function. No circular dependency.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `apps/web/src/lib/wizard/highlightText.tsx` | Modify | Add optional 3rd param `options?: { hoveredEntityId?: string \| null }`. Conditional class on `<mark>` when matched. |
| `apps/web/src/components/wizard/EntityInspector.tsx` | Modify | Add `onEntityHover?` prop. Wire `onMouseEnter`/`onMouseLeave` on entity row `<button>` elements. |
| `apps/web/src/app/review/page.tsx` | Modify | Add `hoveredEntityId` state + `handleEntityHover` callback. Pass to both children. |
| `apps/web/src/lib/wizard/highlightText.test.tsx` | Modify | Add 3 test cases for hover variant. |
| `apps/web/src/components/wizard/EntityInspector.test.tsx` | Modify | Add 4 test cases for hover signal. |

## Interfaces / Contracts

```typescript
// highlightText.tsx — new options parameter
interface HighlightOptions {
  hoveredEntityId?: string | null;
}

export function renderHighlightedText(
  text: string,
  entities: Entity[],
  options?: HighlightOptions,
): ReactNode;

// EntityInspector.tsx — new optional prop
interface EntityInspectorProps {
  entities: Entity[];
  onEntityUpdate?: (entity: Entity) => void;
  onAddEntity?: () => void;
  manualEntityCount?: number;
  manualEntityLimit?: number;
  onEntityHover?: (entityId: string | null) => void;  // NEW
}
```

**CSS class mapping** (inside `renderHighlightedText`):

| Condition | ALTA | MEDIA/BAJA |
|-----------|------|------------|
| Default (no hover match) | `bg-success/20 border-b-2 border-success/50` | `bg-warning/20 border-b-2 border-warning/50` |
| Hovered (id matches) | `bg-success/35 border-b-2 border-success` | `bg-warning/35 border-b-2 border-warning` |

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit — `highlightText` | Hovered entity gets elevated class; non-hovered keeps default; null/omitted → all default; entity without sourceSpan → no error | Render with `renderHighlightedText(text, entities, { hoveredEntityId })`, assert `className` on `<mark>` |
| Unit — `EntityInspector` | `onEntityHover(id)` on mouseEnter; `onEntityHover(null)` on mouseLeave; works for excluded rows; no error when prop omitted | `fireEvent.mouseEnter`/`mouseLeave` on row `<button>`, assert `vi.fn()` calls |
| Integration | ReviewPage wiring (smoke) | Deferred — existing page tests cover render; hover wiring is straightforward prop drilling |

**TDD order**: tests first for `highlightText` → implement → tests for `EntityInspector` → implement → wire in `page.tsx` → manual verify.

## Migration / Rollout

No migration required. All changes are additive — `hoveredEntityId` defaults to `null`/`undefined`, preserving existing behavior. Single revert-safe PR.

## Open Questions

- [ ] Should the priority review section `<div>` rows also emit hover signals? Currently deferred since the same entities appear in the group `<button>` rows.
