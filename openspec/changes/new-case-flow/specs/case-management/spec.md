# case-management Specification

## Purpose

Manage the full lifecycle of legal cases — creation from a template, draft saving, generation, and archival. Cases are owned by a single user with RLS-enforced isolation.

## Requirements

| # | Requirement | MUST/SHALL |
|---|-------------|-----------|
| R1 | **Create Case** — `POST /api/cases` with `{ templateId }` MUST create a case with status `borrador`, empty `form_data`, and return the full case. Template MUST exist and belong to the user. | MUST |
| R2 | **Read Case** — `GET /api/cases/:id` MUST return case metadata, form_data, generated_text, and associated template entities. | MUST |
| R3 | **List Cases** — `GET /api/cases?status=` MUST return all cases for the authenticated user, optionally filtered by status. Metadata only — no `generated_text`. | MUST |
| R4 | **Update Form Data** — `PATCH /api/cases/:id` with `{ formData }` MUST merge partial form data. Cases with status `generado` or `archivado` MUST be read-only (409). | MUST |
| R5 | **Archive Case** — `PATCH /api/cases/:id` with `{ status: 'archivado' }` MUST soft-delete the case. Archived cases SHALL NOT appear in default listings. | MUST |
| R6 | **RLS Isolation** — Every operation MUST enforce `casos.user_id` matches the authenticated user via RLS policies. Cross-user access MUST return 404/401. | MUST |

## Scenarios

#### R1: Create case from template
- **Given** the user is authenticated and a template exists
- **When** `POST /api/cases { templateId }` is called
- **Then** a case with status `borrador` and empty `form_data` is returned

#### R1: Create case with non-existent template
- **Given** the user is authenticated
- **When** `POST /api/cases { templateId: "non-existent" }` is called
- **Then** a 404 error is returned

#### R4: Save draft preserves form data
- **Given** a case in `borrador` status
- **When** `PATCH /api/cases/:id { formData: { "ent_1": "Juan Pérez" } }` is called
- **Then** the case is updated and reloading retrieves saved data

#### R4: Cannot update generated case
- **Given** a case with status `generado`
- **When** `PATCH /api/cases/:id { formData: {...} }` is called
- **Then** a 409 error is returned

#### R5: Archive hides case
- **Given** a case in `exportado` status
- **When** `PATCH /api/cases/:id { status: 'archivado' }` is called
- **Then** `GET /api/cases` no longer includes it by default

#### R6: Cross-user isolation
- **Given** user A has a case
- **When** user B attempts `GET /api/cases/:id` (user A's case)
- **Then** a 404 or 401 error is returned
