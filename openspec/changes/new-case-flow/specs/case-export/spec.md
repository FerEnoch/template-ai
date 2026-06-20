# case-export Specification

## Purpose

Export the generated legal document to PDF and DOCX formats using client-side libraries. Includes progress UI, file download with naming conventions, and status transitions.

## Requirements

| # | Requirement | MUST/SHALL |
|---|-------------|-----------|
| R1 | **Export PDF** — Clicking "Exportar PDF" MUST call `jspdf` to generate a PDF with Source Serif 4 body text, justified alignment, and signature zones. | MUST |
| R2 | **Export DOCX** — Clicking "Exportar DOCX" MUST call the `docx` npm package to produce a valid OOXML file with headings and paragraphs. | MUST |
| R3 | **Progress UI** — During generation, an `ExportSpinner` MUST display (p21-style: spinner + "Exportando documento..."). Both buttons MUST be disabled. | MUST |
| R4 | **Download** — On success, the browser MUST download via `URL.createObjectURL`. Filename MUST be `${template.slug}-${case.id.slice(0,8)}.${ext}`. | MUST |
| R5 | **Status Transition** — After successful download, case status MUST transition to `exportado` via `PATCH /api/cases/:id`. | MUST |
| R6 | **Error Recovery** — On failure, the spinner MUST dismiss, an inline error MUST display ("Error al exportar. Intente nuevamente."), and buttons MUST re-enable. | MUST |

## Scenarios

#### R1: Export PDF
- **Given** the preview page with generated text
- **When** the user clicks "Exportar PDF"
- **Then** the spinner shows "Exportando PDF..."
- **And** a file downloads as `contrato-arrendamiento-a1b2c3d4.pdf`

#### R2: Export DOCX
- **Given** the preview page with generated text
- **When** the user clicks "Exportar DOCX"
- **Then** the spinner shows "Exportando DOCX..."
- **And** a valid `.docx` file downloads

#### R3: Export in progress locks buttons
- **Given** export generation is running
- **When** the spinner is active
- **Then** both export buttons are disabled

#### R5: Status transition
- **Given** a case with status `generado`
- **When** PDF export completes successfully
- **Then** `PATCH /api/cases/:id { status: 'exportado' }` is called

#### R6: Export error recovery
- **Given** jsPDF throws an error during generation
- **When** the error is caught
- **Then** an inline error "Error al exportar. Intente nuevamente." appears
- **And** both buttons are re-enabled
