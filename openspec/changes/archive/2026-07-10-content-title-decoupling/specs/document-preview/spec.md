# Delta for document-preview

## ADDED Requirements

### Requirement: ExportPanel filename/display separation

`ExportPanel` MUST accept separate `filenameSlug` (slugified, lowercased) and `displayTitle` (original case) props. `displayTitle` SHALL be passed as the document title to PDF/DOCX generators. `filenameSlug` SHALL be used only for `buildFilename()`. The `templateSlug` prop MUST be removed.

| Scenario | Given | When | Then |
|----------|-------|------|------|
| Original case in document | Case name "Compraventa-Inmobiliaria-Gómez" | Export to PDF | Document heading is "Compraventa-Inmobiliaria-Gómez" |
| Slug for filename | Same case | Export to PDF | Downloaded file is "compraventa-inmobiliaria-gomez.pdf" |
| Separate props | displayTitle="My Doc", filenameSlug="my-doc" | ExportPanel renders | PDF title uses "My Doc", filename uses "my-doc.pdf" |

#### Scenario: Original case preserved in document heading

- GIVEN a case named "Compraventa-Inmobiliaria-Gómez-Morvan"
- WHEN the user exports to PDF
- THEN the document heading displays "Compraventa-Inmobiliaria-Gómez-Morvan" with original casing

#### Scenario: Filename is slugified and lowercased

- GIVEN a case named "Compraventa-Inmobiliaria-Gómez-Morvan"
- WHEN the export completes
- THEN the downloaded filename is "compraventa-inmobiliaria-gomez-morvan.pdf"

#### Scenario: displayTitle and filenameSlug are independent

- GIVEN `displayTitle="Factura 2025"` and `filenameSlug="factura-2025"`
- WHEN ExportPanel generates the export
- THEN the PDF heading is "Factura 2025" and the filename is "factura-2025.pdf"
