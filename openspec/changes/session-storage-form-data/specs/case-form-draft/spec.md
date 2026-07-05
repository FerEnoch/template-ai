# case-form-draft Specification

## Purpose

SessionStorage-backed draft persistence for the new-case form at `/nuevo/[templateId]`. Survives unmount, back/forward navigation, and browser refresh within the same tab. Mirrors the wizard's `localStorage` pattern but scoped to `sessionStorage` (per-tab, auto-cleared on tab close).

## Requirements

| # | Requirement | MUST/SHALL |
|---|-------------|-----------|
| R1 | **Draft Schema** — Draft data MUST conform to `CaseFormDraftSchema` (Zod): `{ caseId, templateId, formData: Record<string,string>, savedAt }`. Keyed as `case-form-draft:v1` in `sessionStorage`. | MUST |
| R2 | **Write on Change** — Every `UPDATE_FIELD` dispatch MUST enqueue a debounced write (300ms) of the full `formData` to `sessionStorage`. Only one `setItem` per debounce window. | MUST |
| R3 | **Hydrate on Mount** — On `setCase`, if a draft exists and `draft.caseId === caseItem.id`, the form MUST hydrate `formData` from the draft before the first user interaction. | MUST |
| R4 | **Stale-Key Filter** — On hydrate, draft keys MUST be intersected with `template.entities[].id`. Unknown keys MUST be dropped. | MUST |
| R5 | **Clear on Terminate** — `clearCaseFormDraft()` MUST remove the `case-form-draft:v1` key on successful `handleGenerate` (status → `generado`) and successful `handleSave`. | MUST |
| R6 | **SSR Safety** — All `sessionStorage` access MUST be guarded with `typeof window === "undefined"`; MUST return `null` server-side. | MUST |
| R7 | **Graceful Degradation** — All `sessionStorage` calls MUST be wrapped in `try/catch`. Failures (quota, disabled storage) MUST silently degrade — the form continues working without the draft. | MUST |

## Scenarios

#### R2: Debounced write on field change
- **Given** the user types in a field
- **When** `UPDATE_FIELD` dispatches
- **Then** `sessionStorage.setItem("case-form-draft:v1", ...)` fires within 300ms

#### R3: Restore draft on remount
- **Given** a draft with `caseId: "abc"` exists in `sessionStorage`
- **When** `/nuevo/X?caseId=abc` mounts
- **Then** `formData` is populated from the draft before user interaction

#### R4: Drop stale entity keys
- **Given** a draft contains `{ ent_old: "x", ent_new: "y" }` and template entities are `["ent_new"]`
- **When** hydration fires
- **Then** `ent_old` is dropped; only `ent_new: "y"` is loaded

#### R5: Clear on generation success
- **Given** a draft exists and `handleGenerate` resolves with status `generado`
- **When** `clearCaseFormDraft()` is called
- **Then** `sessionStorage.removeItem("case-form-draft:v1")` fires; the key is absent

#### R7: Storage failure degrades silently
- **Given** `sessionStorage` throws `QuotaExceededError`
- **When** `saveCaseFormDraft()` is called
- **Then** the error is caught; the form remains functional without the draft
