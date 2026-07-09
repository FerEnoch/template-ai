# case-form-rendering Specification

## Purpose

Render a dynamic form from template entities organized by `Entity.group` into accordion sections. Supports field types, validation, draft auto-save, repeatable entities, and progress tracking.

## Requirements

| # | Requirement | MUST/SHALL |
|---|-------------|-----------|
| R1 | **Load Form** — The form MUST fetch the template via `GET /api/templates/:id` and render one input per `Entity`, keyed by entity ID. | MUST |
| R2 | **Group Sections** — Entities MUST be grouped by `Entity.group` (PARTES, INMUEBLE, FECHAS, ANEXOS) into expandable accordion sections showing field count and completion. | MUST |
| R3 | **Field Types** — The form MUST infer type from label: "fecha" → date, "monto"/"valor"/"precio" → number, "acepta"/"conforme" → checkbox. Default: text. | MUST |
| R4 | **Validation** — Required fields MUST show p17-style inline errors ("Este campo es obligatorio") on submit/blur. The "Generar documento" button MUST disable until ≥80% required fields are filled. | MUST |
| R5 | **Progress Tracking** — A sticky progress bar MUST show "X de Y campos completados" and a progress percentage. | MUST |
| R6 | **Auto-Save** — `PATCH /api/cases/:id` MUST fire every 30s with current form data. A manual "Guardar borrador" button MUST force immediate save without full validation. | MUST |
| R7 | **Repeatable Entities** — The PARTES group SHOULD support add/remove: "Agregar parte" adds a new input row with its own label and value. | SHOULD |

## Scenarios

#### R1: Load form from template
- **Given** a template with 6 entities across 3 groups
- **When** `/nuevo/[templateId]` loads
- **Then** 3 accordion sections render with entity counts

#### R3: Date field inferred from label
- **Given** an entity labeled "Fecha de inicio"
- **When** the user focuses the field
- **Then** a date picker input is displayed

#### R4: Validation error on required empty field
- **Given** a required entity is empty
- **When** the user submits or blurs the field
- **Then** an inline error "Este campo es obligatorio" appears

#### R5: Progress calculation
- **Given** 3 of 8 fields are filled
- **When** the progress bar renders
- **Then** it shows "3 de 8 campos completados" at 37.5%

#### R6: Auto-save triggers
- **Given** the user modified form data
- **After** 30 seconds without manual save
- **Then** `PATCH /api/cases/:id` is called with current data

#### R7: Add additional signatory
- **Given** the PARTES section with 2 entities
- **When** the user clicks "Agregar parte"
- **Then** a new input row appears in PARTES for user to fill
