# Tasks: Hover-to-Highlight Entity Inspector ↔ Preview

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~100 (3 prod + 2 test files) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | single PR |
| Delivery strategy | single-pr |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Hover wiring across 3 files + tests | PR 1 | Base: `main`. Branch: `feat/hover-entity-highlight`. Tests + impl + wiring as one work-unit commit. |

## Phase 1: `renderHighlightedText` TDD

- [x] 1.1 **RED** — Add 3 tests to `highlightText.test.tsx`: (a) hovered ALTA `<mark>` gets `bg-success/35 border-success`; (b) `null`/omitted → all `<mark>` keep `bg-*/20 border-*/50`; (c) hovered id w/o `sourceSpan` → no elevated `<mark>`
- [x] 1.2 **GREEN** — Modify `highlightText.tsx`: add `options?: { hoveredEntityId?: string | null }` 3rd param; `isHovered = entity.id === options?.hoveredEntityId`; when true, swap to `bg-success/35 border-success` (ALTA) or `bg-warning/35 border-warning` (MEDIA/BAJA)
- [x] 1.3 **VERIFY** — `pnpm --filter @template-ai/web test highlightText` → 8 green (5 existing + 3 new)

## Phase 2: `EntityInspector` TDD

- [x] 2.1 **RED** — Add 4 tests to `EntityInspector.test.tsx`: (a) `mouseEnter` on row w/ `sourceSpan` → `onEntityHover(id)`, `mouseLeave` → `onEntityHover(null)`; (b) same for row w/o `sourceSpan`; (c) same for excluded row; (d) prop omitted → no throw, click-to-edit still works
- [x] 2.2 **GREEN** — Modify `EntityInspector.tsx`: add `onEntityHover?: (id: string | null) => void` to `EntityInspectorProps`; on entity row `<button>` (line 282) wire `onMouseEnter={() => onEntityHover?.(entity.id)}` and `onMouseLeave={() => onEntityHover?.(null)}`. Priority `<div>` rows untouched per design.
- [x] 2.3 **VERIFY** — `pnpm --filter @template-ai/web test EntityInspector` → all green

## Phase 3: `ReviewPage` Wiring

- [x] 3.1 In `review/page.tsx` `ReviewInner` add `const [hoveredEntityId, setHoveredEntityId] = useState<string | null>(null)` and `handleEntityHover` callback
- [x] 3.2 Update `renderHighlightedText` call (line 253) to pass `{ hoveredEntityId }` as 3rd arg
- [x] 3.3 Add `onEntityHover={setHoveredEntityId}` to `<EntityInspector />` (line 372)

## Phase 4: Verification

- [x] 4.1 `pnpm --filter @template-ai/web test` — full suite green, no regressions (119/119 pass)
- [x] 4.2 `pnpm typecheck` — clean (pre-existing errors in apps/api and test factories unrelated to this change)
- [ ] 4.3 Manual smoke: hover row → matching `<mark>` elevates `/20`→`/35` + `/50`→full; mouseleave reverts; row w/o `sourceSpan` leaves preview untouched; click-to-edit still opens modal

## Phase 5: Commit & PR

- [x] 5.1 Single work-unit commit per `work-unit-commits`: `feat(wizard): link entity inspector hover to preview highlight` — tests + impl + wiring together
- [ ] 5.2 Branch `feat/hover-entity-highlight` from `main`; push; open PR per `branch-pr` with `Closes #<issue>` (issue must have `status:approved`) and `type:feature` label
