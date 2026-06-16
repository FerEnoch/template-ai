# Proposal: Hover-to-Highlight Entity Inspector ↔ Preview

## Intent

On the review screen, hovering an entity row in `EntityInspector` must subtly emphasize the matching `<mark>` in the document preview. The link is the existing `entity.id` (already the key of every `<mark>` in `renderHighlightedText`).

Pure UI affordance. **No new state shape, no new API, no new persistence field** — only a transient hover id owned by `ReviewPage`.

## Scope

**In**: `useState<string | null>` for `hoveredEntityId` in `review/page.tsx`; optional `hoveredEntityId` on `renderHighlightedText` (`highlightText.tsx`) with a brighter class when matched; `onEntityHover?: (id: string | null) => void` prop on `EntityInspector` wired via `onMouseEnter` / `onMouseLeave` on rows with `sourceSpan`; tests for hover, mouseleave, and no-op rows.

**Out**: keyboard/focus parity, click-to-pin, reverse-direction hover, new animation libs, `Entity` contract changes.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `document-preview`: add `### Requirement: Hovered-entity highlight variant` — preview MUST support an optional `hoveredEntityId` and apply a distinct highlight when matched.
- `entity-editing`: add `### Requirement: Entity row hover signal` — rows with a `sourceSpan` MUST expose hover-start / hover-end callbacks.

## Approach

| Layer | Change | File |
|-------|--------|------|
| State | `useState<string \| null>` for `hoveredEntityId` | `apps/web/src/app/review/page.tsx` |
| Wire | `onEntityHover` → `EntityInspector`; `hoveredEntityId` → `renderHighlightedText` | `apps/web/src/app/review/page.tsx` |
| Render | Conditional class on `<mark>` when matched (e.g. `bg-success/35` + `border-success` vs. `/20` + `/50`) | `apps/web/src/lib/wizard/highlightText.tsx` |
| Inspector | `onMouseEnter` / `onMouseLeave` per row, gated on `sourceSpan` | `apps/web/src/components/wizard/EntityInspector.tsx` |

Same hue family (success/warning), bump opacity and border weight — no new tokens. Rows without `sourceSpan` are not hoverable. State stays local to `ReviewPage`; no context, no store.

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Re-render storm on rapid hover | Low | `renderHighlightedText` re-runs per render; entity count <50. |
| Hover stuck after row removal | Low | React 19 fires `onMouseLeave` before unmount. |
| Visual collision with exclusion strikethrough | Low | Hover variant only changes the *preview* `<mark>`, not the row. |
| Keyboard users excluded | Medium | Out of scope; follow-up focus-parity change. |

## Rollback Plan

Revert the single PR. Change is additive on three files; the `hoveredEntityId === null` default path preserves existing behavior. No migration.

## Dependencies

React 19 mouse handlers (already in use) and existing Tailwind opacity utilities (`/20`, `/35`, `/50`).

## Success Criteria

- [ ] Hovering a row with `sourceSpan` changes the matching `<mark>` style within one frame; mouseleave restores it.
- [ ] Hovering a row without `sourceSpan` has no effect on the preview; tests cover both branches.
- [ ] `pnpm --filter @template-ai/web test` and `pnpm typecheck` pass; PR diff <400 lines.
