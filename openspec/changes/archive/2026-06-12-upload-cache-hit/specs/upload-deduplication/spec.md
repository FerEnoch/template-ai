# upload-deduplication Specification

## Purpose

Short-circuit re-uploads of byte-identical files at `POST /api/documents/upload` by deriving a SHA-256 content hash from the raw buffer before any disk write or DB insert. When a prior completed analysis exists for that hash, return it immediately and skip all downstream work.

## Requirements

### Requirement: Content hash computation on upload

The system MUST compute a SHA-256 hash from the raw file buffer on `POST /api/documents/upload`. The hash MUST be derived from the buffer bytes before any disk write, DB insert, or BullMQ enqueue. The hash MUST be stored in a `documents.content_hash` column.

#### Scenario: Hash computed and stored on first upload

- GIVEN a file never uploaded before
- WHEN the upload request arrives
- THEN a SHA-256 hash is computed from the raw bytes
- AND the hash is persisted in the `content_hash` column of the new `documents` row

#### Scenario: Same file produces identical hash

- GIVEN two upload requests with byte-identical files
- WHEN each request computes its content hash
- THEN both hashes are equal

### Requirement: Upload cache-hit short-circuit

Before writing the file to disk or inserting any DB row, the system MUST query for an existing `documents` row with the same `content_hash` that has a `completed` analysis. If found, the system MUST return the prior result immediately — skipping disk write, `documents` insert, `analysis_results` insert, and BullMQ enqueue. The HTTP response MUST include `X-Cache: HIT`.

#### Scenario: Re-upload returns cached result

- GIVEN a file was uploaded and its analysis completed within the last 7 days
- WHEN the identical file is re-uploaded
- THEN the system returns the previous `documentId`, `analysisId`, and `entities`
- AND `X-Cache` header is `HIT`
- AND no new `documents` row, `analysis_results` row, or BullMQ job is created
- AND no file is written to disk

#### Scenario: First upload proceeds normally

- GIVEN a file with no matching `content_hash` in the database
- WHEN the upload request arrives
- THEN the system follows the standard upload-and-analyze flow
- AND `X-Cache` header is `MISS`

#### Scenario: Duplicate hash with non-completed analysis retries upload

- GIVEN a `documents` row with the same `content_hash` exists but has no `completed` analysis
- WHEN the identical file is re-uploaded
- THEN the system proceeds with a fresh upload and analysis

### Requirement: Feature flag guard for deduplication

When `AI_CACHE_ENABLED` is `false`, the upload endpoint MUST NOT perform the content-hash lookup. The system MUST behave exactly as before this change — no cache check, no `X-Cache` header, no `content_hash` column stamping.

#### Scenario: Flag disabled skips cache logic

- GIVEN `AI_CACHE_ENABLED=false`
- WHEN any file is uploaded
- THEN the content-hash lookup is never executed
- AND a new `documents` row is inserted with `content_hash` left NULL

### Requirement: Cache-eligible first request still enqueues analysis

When a cache MISS occurs (first upload of a file), the system MUST proceed with the standard pipeline: write to disk, insert `documents` and `analysis_results` rows, stamp `content_hash`, and enqueue the BullMQ job. The response MUST include `X-Cache: MISS`.

#### Scenario: First upload flows to worker

- GIVEN a new file with no prior hash match
- WHEN uploaded
- THEN the file is written to disk
- AND `documents` and `analysis_results` rows are inserted with `content_hash` set
- AND a BullMQ job is enqueued
- AND `X-Cache: MISS` is returned
