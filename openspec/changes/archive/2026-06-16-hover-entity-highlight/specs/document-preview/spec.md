# Delta for Document Preview

## ADDED Requirements

### Requirement: Hovered-entity highlight variant

The system MUST support an optional `hoveredEntityId` parameter on `renderHighlightedText`. When the parameter matches an entity's `id`, the corresponding `<mark>` element SHALL render with elevated opacity and border weight using the same confidence color family (success for ALTA, warning for MEDIA/BAJA). Non-matched entities MUST retain their default styling.

(Previously: no hover-based highlight variant existed — all `<mark>` elements rendered with uniform opacity)

#### Scenario: Hovered entity gets elevated highlight

- GIVEN `renderHighlightedText(text, entities, { hoveredEntityId: "abc-123" })` is called
- AND entity "abc-123" has `confidence: "ALTA"` and `sourceSpan`
- WHEN the preview renders
- THEN the `<mark key="abc-123">` renders with `bg-success/35 border-b-2 border-success` (elevated)
- AND other `<mark>` elements retain `bg-success/20 border-b-2 border-success/50` (default)

#### Scenario: No hover — all entities use default styling

- GIVEN `renderHighlightedText(text, entities)` is called with `hoveredEntityId: null` or omitted
- WHEN the preview renders
- THEN all `<mark>` elements use default opacity classes (`bg-success/20`, `bg-warning/20`)
- AND no elevated highlight is applied to any entity

#### Scenario: Hovered entity has no sourceSpan — no highlight applied

- GIVEN `hoveredEntityId: "manual-xyz"` matches a userCreated entity without `sourceSpan`
- WHEN `renderHighlightedText` renders
- THEN no `<mark>` is highlighted (entity is filtered out by sourceSpan check)
- AND no error or warning is emitted

#### Scenario: Hover ends — style reverts

- GIVEN the preview is rendering with `hoveredEntityId: "abc-123"` (elevated highlight active)
- WHEN the parent re-renders with `hoveredEntityId: null`
- THEN the previously elevated `<mark>` reverts to default styling
- AND visual continuity is maintained (no flash or jank)
