# Delta for shared-contracts

## MODIFIED Requirements

### Requirement: AnalysisResult schema

The system MUST define an `AnalysisResult` schema with fields: `documentId` (uuid string), `status` (enum: pending, processing, **analyzing**, completed, failed), `entities` (array of Entity), `progress` (integer 0–100), `startedAt` (ISO datetime), `completedAt` (ISO datetime, nullable).

(Previously: status enum omitted "analyzing" — the runtime Zod schema in `packages/contracts/src/schemas.ts` already included it, but the spec was out of sync with the code)

#### Scenario: Completed analysis with entities

- GIVEN an analysis result with status "completed" and 8 entities
- WHEN parsed by the AnalysisResult schema
- THEN validation succeeds and entities array is accessible

#### Scenario: Analyzing status validates

- GIVEN an analysis result with `status: "analyzing"` (mid AI phase)
- WHEN parsed by the AnalysisResult schema
- THEN validation succeeds
- AND the inferred TypeScript type narrows `status` to include "analyzing" as a valid value
