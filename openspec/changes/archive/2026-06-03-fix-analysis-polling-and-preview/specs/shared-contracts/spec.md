# Delta for shared-contracts

## MODIFIED Requirements

### Requirement: AnalysisResult schema

The system MUST define an `AnalysisResult` schema with fields: `documentId` (uuid string), `status` (enum: pending, processing, completed, failed), `entities` (array of Entity), `progress` (integer 0–100), `startedAt` (ISO datetime), `completedAt` (ISO datetime, nullable), `extractedText` (string, nullable).

(Previously: no extractedText field — entities-only preview)

#### Scenario: Completed analysis with extracted text

- GIVEN an analysis result with `extractedText: "Invoice #123..."`
- WHEN parsed by the AnalysisResult schema
- THEN validation succeeds and `extractedText` is accessible on the inferred type

#### Scenario: Null extracted text (backward compatibility)

- GIVEN an analysis result created before this field existed with `extractedText: null`
- WHEN parsed by the AnalysisResult schema
- THEN validation succeeds (null is valid for this field)
