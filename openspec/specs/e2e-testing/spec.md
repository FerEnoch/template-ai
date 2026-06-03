# E2E Testing Specification

## Purpose

Establish Playwright E2E test infrastructure and cover critical wizard paths: happy path, entity editing, error scenarios, and library page.

## Requirements

### Requirement: Playwright installation and configuration

The system MUST install `@playwright/test` as a dev dependency in `apps/web`. A `playwright.config.ts` MUST configure the test runner with `webServer` pointing to the Next.js dev server. An npm script `test:e2e` MUST run Playwright tests.

#### Scenario: E2E tests run via npm script

- GIVEN Playwright is installed and configured
- WHEN `npm run test:e2e` is executed
- THEN the Next.js dev server starts
- AND tests execute against it

### Requirement: Happy path test

The system MUST provide an E2E test covering the full wizard flow: upload → analysis → review → save.

#### Scenario: Full wizard happy path

- GIVEN the app is running with MSW enabled
- WHEN the test uploads a valid PDF file
- AND waits for analysis to complete
- AND navigates through the review step
- AND submits the save form with a valid name
- THEN the success state is displayed

### Requirement: Entity editing test

The system MUST provide an E2E test verifying entity editing: opening the modal, editing a value, changing confidence, and excluding an entity.

#### Scenario: Entity value edited

- GIVEN the review step displays entities
- WHEN the test clicks an entity row
- AND edits the value field in the modal
- AND confirms the change
- THEN the updated value appears in the review view

#### Scenario: Entity excluded

- GIVEN the edit modal is open
- WHEN the test clicks "Excluir"
- THEN the entity row shows excluded styling

### Requirement: Error scenario tests

The system MUST provide E2E tests for: upload failure (500), analysis failure (status: "failed"), and save conflict (409). Each test MUST verify the frontend displays an appropriate error message.

#### Scenario: Upload failure displayed

- GIVEN the mock upload endpoint returns 500
- WHEN the test uploads a file
- THEN an error message is displayed on the upload page

#### Scenario: Analysis failure displayed

- GIVEN the mock analysis endpoint returns status "failed"
- WHEN the test waits for analysis
- THEN an error message is displayed on the analysis page

#### Scenario: Save conflict displayed

- GIVEN the mock save endpoint returns 409
- WHEN the test submits the save form
- THEN a conflict error message is displayed

### Requirement: Library page test

The system MUST provide an E2E test verifying the library page: empty state and template list display.

#### Scenario: Library empty state

- GIVEN no templates exist
- WHEN the test navigates to `/biblioteca`
- THEN the empty state message is visible

#### Scenario: Library with templates

- GIVEN mock templates exist
- WHEN the test navigates to `/biblioteca`
- THEN template cards are visible with correct data
