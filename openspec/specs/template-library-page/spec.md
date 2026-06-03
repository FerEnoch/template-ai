# Template Library Page Specification

## Purpose

Provide a read-only page at `/biblioteca` displaying saved templates in a grid layout, with navigation from the sidebar.

## Requirements

### Requirement: Library page route

The system MUST provide a page at `/biblioteca` accessible via the application sidebar. The sidebar link MUST display an active state when the user is on this route.

#### Scenario: Navigation to library page

- GIVEN the user is on any page with the sidebar visible
- WHEN the user clicks "Biblioteca" in the sidebar
- THEN the app navigates to `/biblioteca`
- AND the sidebar link shows active styling

### Requirement: Template grid display

The system MUST fetch templates via `GET /api/templates` and render them as a grid of cards. Each card MUST display: template name, category, creation date, and entity count.

#### Scenario: Templates displayed as cards

- GIVEN 3 templates exist in the mock data
- WHEN the user visits `/biblioteca`
- THEN a grid of 3 cards renders
- AND each card shows name, category, date, and entity count

#### Scenario: Data sourced from mock API

- GIVEN the library page loads
- WHEN network requests are inspected
- THEN a `GET /api/templates` request was made

### Requirement: Empty state

The system MUST display an empty state message when no templates exist. The empty state MUST guide the user to create their first template.

#### Scenario: No templates exist

- GIVEN zero templates are saved
- WHEN the user visits `/biblioteca`
- THEN an empty state message appears
- AND a prompt to create a template is shown
