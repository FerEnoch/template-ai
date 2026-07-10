# Delta for shared-contracts

## ADDED Requirements

### Requirement: CaseSchema contentTitle field

`CaseSchema` MUST include `contentTitle: z.string().nullable().optional()`. `UpdateCaseFormDataSchema` MUST include `contentTitle: z.string().nullable().optional()`. Both inferred types SHALL expose `contentTitle: string | null | undefined`.

| Scenario | Given | When | Then |
|----------|-------|------|------|
| contentTitle with string | `{ name: "X", contentTitle: "Y" }` | Parsed by CaseSchema | Validation succeeds, type includes `contentTitle: string` |
| contentTitle null | `{ name: "X", contentTitle: null }` | Parsed by CaseSchema | Validation succeeds, `contentTitle: null` |
| contentTitle omitted | `{ name: "X" }` | Parsed by CaseSchema | Validation succeeds, `contentTitle: undefined` |

#### Scenario: CaseSchema accepts contentTitle

- GIVEN a case object with `name: "Test"` and `contentTitle: "Document Title"`
- WHEN parsed by CaseSchema
- THEN validation succeeds and `contentTitle` is accessible on the inferred type

#### Scenario: contentTitle nullable and optional

- GIVEN a case object with `contentTitle: null`
- WHEN parsed by CaseSchema
- THEN validation succeeds with `contentTitle: null`

#### Scenario: contentTitle absent is valid

- GIVEN a case object without a `contentTitle` key
- WHEN parsed by CaseSchema
- THEN validation succeeds (field is optional)

#### Scenario: UpdateCaseFormDataSchema accepts contentTitle

- GIVEN a PATCH body `{ contentTitle: "Nuevo Título" }`
- WHEN parsed by UpdateCaseFormDataSchema
- THEN validation succeeds and the value is accepted
