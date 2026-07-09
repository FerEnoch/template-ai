# Delta for case-form-rendering

## ADDED Requirements

### Requirement: SessionStorage Draft Integration

The form MUST integrate with `case-form-draft:v1` in `sessionStorage` for draft persistence. On mount with a matching `caseId`, the form MUST hydrate `formData` from the stored draft. On every `UPDATE_FIELD`, the form MUST write the current `formData` to `sessionStorage` debounced at 300ms.

#### Scenario: Hydrate from sessionStorage on mount
- **Given** `sessionStorage` contains a valid draft with `caseId` matching the current case
- **When** `CaseProvider` mounts and `setCase` fires
- **Then** `formData` is populated from the draft, intersected with template entity IDs (stale keys dropped)

#### Scenario: Write to sessionStorage on field change
- **Given** the form is mounted and the user edits a field
- **When** `UPDATE_FIELD` dispatches
- **Then** the full `formData` is written to `sessionStorage` within 300ms (debounced)

#### Scenario: No draft — fallback to server
- **Given** `sessionStorage` has no draft for the current `caseId`
- **When** `CaseProvider` mounts
- **Then** existing `setCase` behavior applies (falls back to server `caseItem.formData`)
