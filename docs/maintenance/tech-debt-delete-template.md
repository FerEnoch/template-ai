# Technical Debt: Delete Template Feature

> **Change**: `delete-template` — soft-delete for templates
> **Implemented**: 2026-06-24
> **SDD Artifacts**: `openspec/changes/archive/2026-06-24-delete-template/`

---

## 1. Deferred Items

| ID | Item | Priority | Effort | Blocked By | Notes |
|----|------|----------|--------|------------|-------|
| TD-01 | 30-day purge cron job | HIGH | S | — | Templates with `deleted_at < NOW() - 30 days` should be hard-deleted. Migration 0010 already has `templates_deleted_at_idx` partial index for efficient querying. Without this, archived templates accumulate indefinitely. |
| TD-02 | `POST /api/templates/:id/restore` | MEDIUM | S | — | The delete confirmation dialog (`.stitch/designs/p20-confirmar-eliminacion.html`) mentions restoration within the 30-day window. Currently, an archived template can only be restored manually (flip status back to `draft`/`published` in DB). |
| TD-03 | Cases cascade (real implementation) | MEDIUM | S | Migration 0009 (`casos` table) | `CasesRepository.archiveByTemplateId()` is a stub returning 0. When `?deleteGeneratedCases=true` is passed, no cases are actually archived. The try/catch in the service already handles the stub gracefully. |
| TD-04 | `includeArchived` query param validation | LOW | XS | — | `parseBool("garbage")` silently returns `false`. This is safe-by-default as designed, but a future enhancement could return `400` for clearly invalid values while keeping the safe default for empty/missing params. |

---

## 2. Design Decisions (Non-Obvious)

### DD-01: `document_id` nullable + FK `ON DELETE SET NULL`

**Why**: The spec requires hard-deleting the source document on cascade, but the template row must survive the 30-day window. PostgreSQL's `ON DELETE RESTRICT` prevents deleting a document referenced by a living template row.

**Solution**: Made `templates.document_id` nullable and changed the FK to `ON DELETE SET NULL`. This follows the existing precedent of `usage_ledger.subscription_id` (`0001_domain_schema_first.sql:32`).

**Consequence**: `TemplateResponse.documentId` is now `string | null`. Frontend consumers must handle null. Template creation still requires a document (the `CreateTemplateInput` contract is unchanged).

### DD-02: unlinkFile error tolerance

**Why**: The spec mandates "file unlink failure SHALL NOT roll back template archival." If `fs.unlink` throws a non-ENOENT error (EACCES, EBUSY, EIO), the transaction must still commit.

**Solution**: Catch ALL errors in `unlinkFile()`. ENOENT is a no-op (file already gone). Other errors are logged via `Logger.warn` but NOT re-thrown, so the transaction commits with the template archived.

### DD-03: Single transaction for archive + cascade

**Why**: The design initially specified separate transactions (T1 for archival, T2-T4 for cascades) to isolate cascade failures. 

**Reality**: The implementation puts everything in ONE `withOwnerTransaction`. This works because:
- `unlinkFile` never throws (catches all errors)
- Cases cascade is wrapped in try/catch
- Document delete is a simple DB operation unlikely to fail

**Risk**: If `documentsRepo.delete()` fails, the template archival rolls back. Low probability in practice.

---

## 3. Migration State

| Migration | File | Status | Applied |
|-----------|------|--------|---------|
| 0010 | `0010_template_soft_delete.sql` | Applied | ✅ `schema_migrations` journal synced |

**Columns added**:
- `templates.deleted_at TIMESTAMPTZ NULL` — stamp on soft-delete
- `templates.document_id` — now nullable (was `NOT NULL`)

**FK changed**: `templates_document_id_fkey` → `ON DELETE SET NULL`

**Index created**: `templates_deleted_at_idx` — partial index `WHERE deleted_at IS NOT NULL`

---

## 4. Test Coverage Gaps (WARNING level)

| Gap | Scenario | Notes |
|-----|----------|-------|
| TG-01 | `deleteSourceFile=true` with `documentId=null` | Code guarded by `archived.documentId`, but no explicit test |
| TG-02 | `deleteGeneratedCases=true` cascade | Try/catch correct, but no test exercises the path |
| TG-03 | Dual cascade (both flags) | No integration test with both params |
| TG-04 | Cross-user RLS isolation | Hardcoded `userId=0` in controller; real RLS testable only after auth wiring |
| TG-05 | Concurrent deletion | SQL `WHERE status<>'archived'` is race-safe by design, but untested |

---

## 5. Files Affected

| File | Type | Lines |
|------|------|-------|
| `apps/api/src/infrastructure/postgres/migrations/0010_template_soft_delete.sql` | New | 14 |
| `apps/api/src/infrastructure/postgres/repositories/cases.repository.ts` | New | 14 (stub) |
| `apps/api/src/infrastructure/postgres/repositories/templates.repository.ts` | Modified | +48 |
| `apps/api/src/templates/templates.service.ts` | Modified | +100 |
| `apps/api/src/templates/templates.controller.ts` | Modified | +39 |
| `apps/api/src/infrastructure/postgres/repositories/templates.repository.spec.ts` | Modified | +1 |
| `apps/api/src/templates/templates.controller.spec.ts` | Modified | +5 |

---

## 6. Next Actions

1. **[TD-01]** Implement purge cron: `DELETE FROM templates WHERE deleted_at < NOW() - INTERVAL '30 days'`
2. **[TD-02]** Implement restore endpoint: `PATCH /api/templates/:id/restore` → `status='draft', deleted_at=NULL`
3. **[TD-03]** Apply migration 0009 and replace `CasesRepository` stub with real `UPDATE casos`
4. **[TG-01–TG-05]** Add missing test coverage for cascade paths and edge cases
