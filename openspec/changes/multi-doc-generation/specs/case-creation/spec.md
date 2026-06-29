# case-creation Specification

## Purpose

Ensure `POST /api/cases` is idempotent for borrador cases per user-template pair. Prevent duplicate case rows when the frontend bootstrap or network retries issue multiple POSTs.

## Requirements

### Requirement: Idempotent case creation

`CasesService.create` MUST query for an existing `borrador` case matching `(userId, templateId)` BEFORE inserting a new row. The query and INSERT MUST execute within the same `withOwnerTransaction` scope. If an existing borrador is found, the service MUST return it without inserting. If none exists, the service MUST insert and return the new case.

#### Scenario: First POST creates borrador

- GIVEN no borrador exists for user `0` and template `t1`
- WHEN `POST /api/cases` is called with `{ templateId: "t1" }`
- THEN a new case row with `status: "borrador"` is inserted
- AND the response returns the created case with HTTP 201

#### Scenario: Second POST returns existing borrador

- GIVEN a borrador exists for user `0` and template `t1`
- WHEN `POST /api/cases` is called again with `{ templateId: "t1" }`
- THEN no new row is inserted
- AND the response returns the existing borrador with the same `id`
- AND HTTP status is 200 (existing resource)

#### Scenario: Different template creates different case

- GIVEN a borrador exists for user `0` and template `t1`
- WHEN `POST /api/cases` with `{ templateId: "t2" }`
- THEN a new case row is inserted for `t2`
- AND the `t1` case is unaffected

### Requirement: Repository find method

`CasesRepository` MUST expose `findBorradorByUserAndTemplate(userId: string, templateId: string)` returning the matching borrador case or `null`. The query MUST filter by `status = 'borrador'`, `user_id`, and `template_id`.

#### Scenario: Finds existing borrador

- GIVEN a borrador case with `user_id = "0"`, `template_id = "t1"`
- WHEN `findBorradorByUserAndTemplate("0", "t1")` is called
- THEN the case row is returned

#### Scenario: Returns null for no match

- GIVEN no borrador exists for user `0` and template `t99`
- WHEN `findBorradorByUserAndTemplate("0", "t99")` is called
- THEN `null` is returned
