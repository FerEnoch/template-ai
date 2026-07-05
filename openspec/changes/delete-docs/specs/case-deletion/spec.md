# Case Deletion Specification

## Purpose

Soft-delete of generated `casos` via the `/biblioteca` page, mirroring the existing template-deletion UX, backed by the existing `cases.service.archive()`.

## Requirements

### Requirement: DELETE endpoint contract

`DELETE /api/cases/:id` MUST return `204 No Content` with empty body. The endpoint MUST be idempotent on already-archived cases (`status='archivado'`) and MUST return `404` when the case does not exist.

| Scenario | Status | Body |
|---|---|---|
| Active case deleted | 204 | empty |
| Already-archived case deleted | 204 | empty |
| Non-existent case | 404 | error body |

#### Scenario: Delete active case returns 204

- GIVEN a case with `id=1` and `status='active'`
- WHEN `DELETE /api/cases/1` is called
- THEN the response status is `204` with empty body
- AND the case status is `archivado`

#### Scenario: Delete already-archived case is idempotent

- GIVEN a case with `id=2` and `status='archivado'`
- WHEN `DELETE /api/cases/2` is called
- THEN the response status is `204` with empty body

#### Scenario: Delete non-existent case returns 404

- GIVEN no case with `id=999`
- WHEN `DELETE /api/cases/999` is called
- THEN the response status is `404`

### Requirement: CaseCard deletion button

Each `CaseCard` MUST display a `Trash2` icon on hover. The button MUST be hidden when `case.status === 'archivado'`. While the delete request is in flight, the button MUST show a `Loader2` spinner and MUST be disabled.

#### Scenario: Trash2 visible on hover for active case

- GIVEN a `CaseCard` for an active case
- WHEN the user hovers over the card
- THEN a `Trash2` button appears

#### Scenario: Trash2 hidden for archived case

- GIVEN a `CaseCard` for an archived case
- WHEN the user hovers over the card
- THEN no `Trash2` button is visible

#### Scenario: Loading state during deletion

- GIVEN the user clicks `Trash2` and confirms
- WHEN the delete request is pending
- THEN the button shows a `Loader2` spinner and is disabled

### Requirement: Confirmation dialog generalization

`ConfirmDeleteDialog` MUST accept an `itemName` prop (replaces `templateName`). The dialog title and body MUST use `itemName` to describe the item being deleted.

#### Scenario: Dialog shows generic item name

- GIVEN `ConfirmDeleteDialog` receives `itemName="Caso #3"`
- WHEN the dialog renders
- THEN the title and body text reference "Caso #3"

### Requirement: Inline error handling

When `DELETE /api/cases/:id` fails, the affected `CaseCard` MUST display an inline error banner with a retry option. The card MUST NOT be removed from the grid.

#### Scenario: Delete fails, error shown

- GIVEN `DELETE /api/cases/1` fails with a network error
- WHEN the user confirms deletion
- THEN an inline error banner appears on the `CaseCard`
- AND the card remains in the grid
