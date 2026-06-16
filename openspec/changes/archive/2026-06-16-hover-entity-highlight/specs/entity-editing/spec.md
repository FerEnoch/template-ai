# Delta for Entity Editing

## ADDED Requirements

### Requirement: Entity row hover signal

The system MUST accept an optional `onEntityHover?: (id: string | null) => void` callback prop on `EntityInspector`. When a user hovers an entity row button, `onEntityHover(entity.id)` SHALL be called on `onMouseEnter`. When the pointer leaves the row, `onEntityHover(null)` SHALL be called on `onMouseLeave`. The signal MUST fire for ALL visible entity rows — including those without `sourceSpan`, and including excluded entities.

(Previously: no hover signal existed on entity rows)

#### Scenario: Hover over row with sourceSpan emits entity ID

- GIVEN `EntityInspector` renders an entity row button with `sourceSpan` present
- AND `onEntityHover` prop is provided
- WHEN the user moves the mouse over the row (`onMouseEnter` fires)
- THEN `onEntityHover` is called with the entity's `id` string
- AND on subsequent `onMouseLeave`, `onEntityHover` is called with `null`

#### Scenario: Hover over row without sourceSpan still emits signal

- GIVEN `EntityInspector` renders a user-created entity row without `sourceSpan`
- AND `onEntityHover` prop is provided
- WHEN the user moves the mouse over the row
- THEN `onEntityHover` is called with the entity's `id`
- AND on mouse leave, `onEntityHover(null)` is called

#### Scenario: Hover over excluded entity row still emits signal

- GIVEN an entity has `excluded: true` and is visible (dimmed, strikethrough)
- AND `onEntityHover` prop is provided
- WHEN the user hovers the excluded entity row
- THEN `onEntityHover` is called with the entity's `id`
- AND on mouse leave, `onEntityHover(null)` is called

#### Scenario: Rapid hover across multiple rows debounces cleanly

- GIVEN `onEntityHover` is provided
- WHEN the user rapidly moves the mouse across three entity rows (A → B → C)
- THEN calls are emitted in order: `onEntityHover(a.id)`, `onEntityHover(null)`, `onEntityHover(b.id)`, `onEntityHover(null)`, `onEntityHover(c.id)`
- AND no stale or duplicate `id` values linger after `onMouseLeave`

#### Scenario: onEntityHover not provided — no error

- GIVEN `EntityInspector` is rendered without `onEntityHover` prop
- WHEN the user hovers any entity row
- THEN no error is thrown
- AND existing behavior (click-to-edit modal) is unaffected
