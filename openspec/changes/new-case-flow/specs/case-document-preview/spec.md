# case-document-preview Specification

## Purpose

Display the generated legal document as editable paragraphs with inline editing, a verification checklist sidebar, and controls to regenerate or return to the form.

## Requirements

| # | Requirement | MUST/SHALL |
|---|-------------|-----------|
| R1 | **Load Preview** — `GET /api/cases/:id` MUST return the case. If `generated_text` is null, redirect to `/nuevo/[templateId]`. Text MUST render split into paragraphs. | MUST |
| R2 | **Inline Editing** — Each paragraph MUST support p9-style inline edit: click → contenteditable mode with "Guardar"/"Cancelar" buttons. Saved changes MUST persist via `PATCH /api/cases/:id`. | MUST |
| R3 | **Verification Checklist** — A sidebar MUST display 3 collapsible sections (Estructura, Datos, Fechas) with manual checkboxes. Checklist state SHALL NOT persist to DB for MVP. | MUST |
| R4 | **Regenerate** — A "Regenerar" button MUST re-trigger `POST /api/cases/:id/generate`, show the loading screen, and refresh preview on completion. | MUST |
| R5 | **Return to Form** — A "Volver al formulario" button MUST navigate to `/nuevo/[templateId]` preserving form data. | SHOULD |

## Scenarios

#### R1: Load preview with generated text
- **Given** a case with status `generado` and populated `generated_text`
- **When** the user visits `/preview/[caseId]`
- **Then** the document renders as separate paragraphs

#### R1: Redirect when no generated text
- **Given** a case with `generated_text: null`
- **When** the user visits `/preview/[caseId]`
- **Then** they are redirected to `/nuevo/[templateId]`

#### R2: Edit paragraph inline
- **Given** a rendered paragraph
- **When** the user clicks it
- **Then** it enters contenteditable mode with "Guardar" and "Cancelar" buttons
- **When** the user edits and clicks "Guardar"
- **Then** the paragraph display updates with edited text

#### R3: Verify checklist items
- **Given** the preview page is loaded
- **When** the user expands "Estructura"
- **Then** a checkbox "¿Contiene cláusulas, partes y objeto?" appears
- **When** the user checks it
- **Then** it shows checked state locally

#### R4: Regenerate document from preview
- **Given** generated text is displayed
- **When** the user clicks "Regenerar"
- **Then** the loading screen appears and preview refreshes with new text on completion

#### R5: Return to form
- **Given** the user is on the preview page
- **When** the user clicks "Volver al formulario"
- **Then** they navigate to `/nuevo/[templateId]` with existing form data
