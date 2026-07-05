# Delta for Template Library Page

## ADDED Requirements

### Requirement: Case deletion wiring on biblioteca page

The `/biblioteca` page MUST wire case deletion alongside existing template deletion. The page MUST provide `handleDeleteCase` calling `DELETE /api/cases/:id` and `handleDeleteCaseError` for failure display. All existing template-display requirements remain unchanged.

#### Scenario: Case deleted, card removed

- GIVEN the biblioteca page shows active cases and templates
- WHEN the user confirms deletion of a case
- THEN `DELETE /api/cases/:id` is called
- AND on success the case card is removed from the grid

#### Scenario: Case delete error, card persists

- GIVEN the biblioteca page shows active cases
- WHEN `DELETE /api/cases/:id` fails
- THEN the case card persists with an inline error banner
- AND template cards are unaffected
