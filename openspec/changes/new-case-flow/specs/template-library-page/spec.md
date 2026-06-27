# Delta for template-library-page

> Existing requirements (Library page route, Template grid display, Empty state) are **unchanged**. This delta adds the "Nuevo Caso" entry point.

## ADDED Requirements

### Requirement: Template detail page with Nuevo Caso CTA

The system MUST provide a detail page at `/biblioteca/[id]` displaying template metadata and an entity preview list. The page MUST include a primary "Crear nuevo caso" button that navigates to `/nuevo/[templateId]`.

#### Scenario: Navigate from detail page to new case
- **Given** the user is on `/biblioteca/[id]` viewing a template
- **When** the user clicks "Crear nuevo caso"
- **Then** the app navigates to `/nuevo/[templateId]`

#### Scenario: Detail page shows template entities and CTA
- **Given** a template with 5 entities exists
- **When** the user visits `/biblioteca/[id]`
- **Then** entity names and groups are displayed as a preview
- **And** the "Crear nuevo caso" button is prominently visible

### Requirement: Nuevo Caso action on template grid cards

Each template card on `/biblioteca` MAY include a secondary "Nuevo caso" action. When clicked, it MUST navigate to `/nuevo/[templateId]`.

#### Scenario: Click "Nuevo caso" from template card
- **Given** the user is on `/biblioteca` with template cards displayed
- **When** the user clicks "Nuevo caso" on a specific card
- **Then** the app navigates to `/nuevo/[templateId]`
