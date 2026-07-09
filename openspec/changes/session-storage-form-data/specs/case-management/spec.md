# Delta for case-management

## ADDED Requirements

### Requirement: Client-Side Draft Clear

On successful state transition to `generado` (AI generation complete), the client MUST clear `case-form-draft:v1` from `sessionStorage`. On successful manual save, the client MUST also clear the draft. This is a client-only operation — the `PATCH /api/cases/:id` server contract is unchanged.

#### Scenario: Clear draft on generation success
- **Given** a `case-form-draft:v1` key exists and `generateCase` resolves with status `generado`
- **When** the generation flow completes
- **Then** `clearCaseFormDraft()` is called and the `sessionStorage` key is removed

#### Scenario: Clear draft on manual save
- **Given** a `case-form-draft:v1` key exists and the user clicks "Guardar borrador"
- **When** `handleSave` resolves successfully
- **Then** `clearCaseFormDraft()` is called and the `sessionStorage` key is removed

#### Scenario: No clear if save fails
- **Given** a draft exists and `handleSave` fails (network error)
- **When** the save attempt rejects
- **Then** the draft is NOT cleared; `case-form-draft:v1` remains in `sessionStorage`
