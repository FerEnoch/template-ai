# content-title-decoupling Specification

## Purpose

Independent `contentTitle` field on cases, decoupled from display `name`, for use as the internal document heading in PDF/DOCX exports. Fallback chain: `contentTitle ?? name ?? template.name`.

## Requirements

### Requirement: Content title storage

The system MUST store `content_title` as a nullable `TEXT` column on the `casos` table. The column SHALL be additive and NULL by default — no backfill required.

| Scenario | Given | When | Then |
|----------|-------|------|------|
| New column exists | Migration 0012 applied | Querying `casos` schema | Column `content_title TEXT NULL` present |
| No backfill | Existing case with NULL content_title | Exporting to PDF | Fallback chain resolves correctly |

### Requirement: Content title contracts

`CaseSchema` and `UpdateCaseFormDataSchema` MUST include `contentTitle: z.string().nullable().optional()`. The field SHALL accept `null`, `undefined`, or a non-empty string.

| Scenario | Given | When | Then |
|----------|-------|------|------|
| Schema accepts contentTitle | `{ name: "X", contentTitle: "Y" }` | Parsed by CaseSchema | Validation succeeds |
| Schema accepts null | `{ name: "X", contentTitle: null }` | Parsed by CaseSchema | Validation succeeds |
| Schema accepts missing | `{ name: "X" }` (no contentTitle) | Parsed by CaseSchema | Validation succeeds, contentTitle is undefined |

### Requirement: API read/write

`CaseResponse` MUST include `contentTitle: string | null`. `PATCH /api/cases/:id` MUST accept `contentTitle` in the request body. The repository SHALL read and write the `content_title` column.

| Scenario | Given | When | Then |
|----------|-------|------|------|
| GET returns contentTitle | Case with content_title="Compraventa" | `GET /api/cases/:id` | Response includes `contentTitle: "Compraventa"` |
| PATCH updates contentTitle | Existing case | `PATCH /api/cases/:id` with `{ contentTitle: "Nuevo" }` | Case updated, GET returns new value |
| NULL round-trips | Case with content_title=NULL | `GET /api/cases/:id` | Response includes `contentTitle: null` |

### Requirement: Fallback resolution

The document title for export MUST resolve as `contentTitle ?? name ?? template.name`. NULL at every level falls through to the next.

| Scenario | Given | When | Then |
|----------|-------|------|------|
| contentTitle wins | contentTitle="Compraventa", name="Compraventa-Gómez" | Exporting | Document heading is "Compraventa" |
| Falls back to name | contentTitle=null, name="Factura Estándar" | Exporting | Document heading is "Factura Estándar" |
| Falls back to template | contentTitle=null, name=null, template.name="Default" | Exporting | Document heading is "Default" |

### Requirement: Content title editing UI

On `/preview/[id]`, the system MUST render a second `EditableTitle` for `contentTitle`, distinct from the display-name `EditableTitle`. The component SHALL use hover-edit pattern: Enter saves, Escape cancels.

| Scenario | Given | When | Then |
|----------|-------|------|------|
| Edit saves | User edits contentTitle to "Compraventa" and presses Enter | PATCH succeeds | Display updates, export uses new title |
| Escape cancels | User edits and presses Escape | No PATCH sent | Previous value restored |
| Independent from display name | Both EditableTitle instances rendered | User edits one | The other is unaffected |

### Requirement: Export document title

PDF and DOCX exporters MUST use the resolved document title (`contentTitle ?? name ?? template.name`) as the document heading with ORIGINAL CASE preserved. The filename SHALL use a slugified, lowercased version.

| Scenario | Given | When | Then |
|----------|-------|------|------|
| Casing preserved | contentTitle="Compraventa-Inmobiliaria" | Exporting PDF | Heading reads "Compraventa-Inmobiliaria" |
| Slug for filename | Same case | Exporting | Filename is "compraventa-inmobiliaria.pdf" |
