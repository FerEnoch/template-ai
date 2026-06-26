# Verification Report: Delete Template from Library

**Date**: 2026-06-24
**Status**: ⚠️ PARTIAL — 1 CRITICAL finding, 5 WARNINGs
**Next recommended**: `fix-issues` (address CRITICAL before archive)

---

## Executive Summary

The soft-delete implementation is **architecturally sound** — migration, repository, service, and controller layers are well-structured and the majority of spec scenarios are correctly handled. However, there is **one CRITICAL bug**: non-ENOENT file unlink failures propagate into the transaction and abort the soft-delete, violating the spec's "SHALL still reach archived" invariant. Additionally, 5 scenarios lack explicit test coverage.

---

## 1. Migration Checklist

| Check | Status | Evidence |
|-------|--------|----------|
| `deleted_at TIMESTAMPTZ NULL` added | ✅ PASS | Line 4: `ALTER TABLE templates ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL` |
| `document_id` DROP NOT NULL | ✅ PASS | Line 8: `ALTER TABLE templates ALTER COLUMN document_id DROP NOT NULL` |
| FK changed to ON DELETE SET NULL | ✅ PASS | Lines 9-11: constraint dropped and re-added with `ON DELETE SET NULL` |
| Partial index created | ✅ PASS | Lines 13-14: `CREATE INDEX ... WHERE deleted_at IS NOT NULL` |

---

## 2. Spec Coverage (16 scenarios)

| # | Scenario | Status | Evidence |
|---|----------|--------|----------|
| 1 | Soft-delete draft → 204 + status='archived' | ✅ PASS | Controller `@HttpCode(204)` L111; repo `softDelete` sets `status='archived'` L146; integration test L272-319 |
| 2 | Idempotent re-delete → 204 + no DB write | ✅ PASS | Service: `softDelete` returns null → `findById` confirms existence → returns void (L151-161); integration test L321-357; unit test L533-578 |
| 3 | Template not found → 404 | ✅ PASS | Service throws `NotFoundException` when both `softDelete` and `findById` return null (L157-158); integration test L359-368; unit test L503-531 |
| 4 | Cross-user RLS isolation → 404 | ⚠️ WARNING | Relies on `withOwnerTransaction(userId)` + DB-level RLS policy. No explicit multi-user test. Controller hardcodes `userId=0` (POC sentinel) — real RLS isolation not exercisable until auth is wired |
| 5 | Concurrent deletion is safe | ⚠️ WARNING | SQL `WHERE id = $1 AND status <> 'archived'` is atomic and race-safe. No explicit concurrent test, but the conditional UPDATE pattern is correct by design |
| 6 | Cascade deletes source document + physical file | ✅ PASS | Service L173-181: finds doc → unlinks file → deletes doc record; integration test L370-432 verifies file removal + DB row deletion |
| 7 | Template with no source doc when cascade requested → no-op | ⚠️ WARNING | Code path correct: `if (deleteSourceFile && archived.documentId)` guards against null documentId (L173). **No explicit test** |
| 8 | File unlink failure is non-blocking | ❌ **CRITICAL** | `unlinkFile` only catches ENOENT (L190-196). Non-ENOENT errors (EACCES, EBUSY, disk I/O) **propagate** into the transaction callback, causing full transaction rollback — including the soft-delete. Spec says "SHALL still reach archived". See Finding F-01 below |
| 9 | Cascade archives all linked cases | ⚠️ WARNING | Service L163-171: try/catch + logger.warn. `CasesRepository.archiveByTemplateId` is a stub returning 0 (L10-13). **No test** exercises this code path with `deleteGeneratedCases=true` |
| 10 | Template with no cases when cascade requested → no-op | ⚠️ WARNING | Stub returns 0 — correct behavior. **No explicit test** |
| 11 | Dual cascade (source + cases) | ⚠️ WARNING | Code path exists (both flags processed sequentially). **No test** sends both `deleteSourceFile=true&deleteGeneratedCases=true` |
| 12 | Invalid cascade param defaults to safe (false) | ✅ PASS | `parseBool` in both controller (L10-12) and service (L23-27): only `"true"` and `"1"` return true; controller test L246-277 verifies default false |
| 13 | Default listing excludes archived | ✅ PASS | Repo `findByUserId` L90: `AND status != 'archived'` when `includeArchived=false`; repo test L138-148; integration test L304-308 |
| 14 | includeArchived via query param | ✅ PASS | Controller forwards query param (L26-28); integration test L310-318; controller test L69-75 |
| 15 | Invalid includeArchived defaults to false | ✅ PASS | `parseBool("garbage")` returns false; covered by default-false behavior in controller test L47-58 |
| 16 | Template grid display (frontend) | ➖ N/A | API-only change — frontend scenario not applicable |

**Coverage**: 10 fully covered, 5 warnings (correct code but missing tests), 1 CRITICAL bug, 1 N/A

---

## 3. Design Compliance

| Check | Status | Evidence |
|-------|--------|----------|
| T1 transaction: softDelete with conditional WHERE | ✅ PASS | `WHERE id = $1 AND status <> 'archived'` — repo L147 |
| Cascade non-blocking (try/catch + log) | ✅ PASS | Cases cascade wrapped in try/catch + `logger.warn` — service L163-171 |
| parseBool helper: "true"/"1" → true, else false | ✅ PASS | Both controller (L10-12) and service (L23-27) implement correctly |
| @HttpCode(204) on DELETE | ✅ PASS | Controller L111 |
| documentId: string \| null in TemplateRecord/Response | ✅ PASS | Repo L8, Service L37 |
| Cases stub returns 0 | ✅ PASS | `CasesRepository.archiveByTemplateId` returns 0 — cases.repository.ts L12 |

---

## 4. Test Results

```
 Test Files  30 passed | 1 skipped (31)
      Tests  306 passed | 2 skipped (308)
   Duration  2.19s
```

| Metric | Value |
|--------|-------|
| Passed | 306 |
| Failed | 0 |
| Skipped | 2 (pre-existing: `main.process.spec.ts`) |
| Regressions | **None** |

### New test coverage for delete-template:

| Test File | New Tests | Covers |
|-----------|-----------|--------|
| `templates.repository.spec.ts` | 2 (softDelete describe block) | Archive + already-archived null return |
| `templates.service.spec.ts` | 3 (delete describe block) | Soft-delete, 404, idempotency |
| `templates.controller.spec.ts` | 4 (DELETE describe block) | 204, forward flags, 404 propagation |
| `templates.controller.integration.spec.ts` | 4 | Soft-delete+list exclusion, idempotency, 404, cascade source file |

---

## 5. Findings

### F-01 — CRITICAL: `unlinkFile` non-ENOENT failure aborts the transaction

**Scenario**: File unlink failure is non-blocking (#8)

**Problem**: In `templates.service.ts` L185-200, `unlinkFile` only catches `ENOENT`. Any other filesystem error (EACCES, EBUSY, EIO, network-storage timeout) is **re-thrown** at L198. This throw propagates into the `withOwnerTransaction` callback (L146-182), which causes the **entire transaction to rollback** — including the soft-delete UPDATE that already succeeded at L151.

**Spec requirement**: "When the physical file cannot be deleted, the template SHALL still reach `archived` status."

**Impact**: In production, a permissions error or transient I/O issue during file deletion would prevent the template from being soft-deleted at all. The user would see a 500 error and the template would remain in `draft` status.

**Recommended fix**: Catch all errors in `unlinkFile` and log a warning instead of re-throwing:

```typescript
private async unlinkFile(filePath: string): Promise<void> {
  try {
    await fsUnlink(filePath);
  } catch (error: unknown) {
    if (typeof error === "object" && error !== null && "code" in error
        && (error as Record<string, unknown>).code === "ENOENT") {
      return; // already gone — success
    }
    // Non-ENOENT: log but do NOT throw — template must still be archived
    this.logger.warn(
      `Failed to unlink file ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
```

### F-02 — WARNING: Missing test for cascade with no source document (#7)

No test verifies that `deleteSourceFile=true` on a template with `documentId=null` is a safe no-op. The code path is correct (guarded by `archived.documentId` at L173), but untested.

### F-03 — WARNING: Missing test for `deleteGeneratedCases=true` cascade (#9, #10, #11)

No unit or integration test exercises the cases cascade path. The stub returns 0 and the try/catch is correct, but:
- No test sends `deleteGeneratedCases=true`
- No test verifies the try/catch catches a cases-repo failure
- No test sends both cascade flags simultaneously

### F-04 — WARNING: Cross-user RLS isolation untestable (#4)

The controller hardcodes `userId=0` (POC sentinel). RLS isolation depends on DB-level policies + `SET LOCAL app.current_user_id`, which is correctly set by `withOwnerTransaction`. However, no test creates templates under different users and verifies cross-user 404. This is acceptable for POC but should be addressed when auth is wired.

### F-05 — WARNING: No concurrent deletion test (#5)

The conditional `WHERE status <> 'archived'` is provably safe for concurrent access (PostgreSQL row-level locking), but no test simulates parallel DELETE calls. Low risk — the SQL pattern is correct by construction.

### F-06 — SUGGESTION: Spec/design/tasks artifacts missing from openspec

The `openspec/changes/delete-template/` directory does not exist. The spec.md, tasks.md, and design.md files referenced in the verification input were not found in the repository. This makes formal traceability harder. Consider creating these artifacts retroactively for archive completeness.

---

## 6. SQL Injection Analysis

**`archivedFilter` in `findByUserId`** (templates.repository.ts L90):

```typescript
const archivedFilter = includeArchived ? "" : "AND status != 'archived'";
```

This is a **compile-time constant** — the string is either `""` or `"AND status != 'archived'"`. The `includeArchived` parameter is a boolean, not user input. **No SQL injection vector.**

All other queries use parameterized `$1`, `$2` placeholders. **No injection vectors found.**

---

## Summary

```json
{
  "status": "partial",
  "executive_summary": "Soft-delete implementation is architecturally sound with all 306 tests passing. One CRITICAL bug: non-ENOENT file unlink failures abort the transaction, violating the spec's 'template SHALL still reach archived' invariant. Five scenarios lack explicit test coverage but have correct code paths.",
  "findings": [
    {"severity": "CRITICAL", "scenario": "File unlink failure is non-blocking (#8)", "detail": "unlinkFile re-throws non-ENOENT errors, causing full transaction rollback including the soft-delete. Must catch all errors and log instead."},
    {"severity": "WARNING", "scenario": "Template with no source doc cascade (#7)", "detail": "Code path correct but untested."},
    {"severity": "WARNING", "scenario": "Cases cascade (#9, #10, #11)", "detail": "No test exercises deleteGeneratedCases=true, dual cascade, or cases failure recovery."},
    {"severity": "WARNING", "scenario": "Cross-user RLS isolation (#4)", "detail": "Relies on DB-level RLS + hardcoded userId=0. Untestable until auth is wired."},
    {"severity": "WARNING", "scenario": "Concurrent deletion (#5)", "detail": "SQL pattern is race-safe by design but no parallel test exists."},
    {"severity": "SUGGESTION", "scenario": "Process", "detail": "openspec/changes/delete-template/ artifacts (spec.md, tasks.md, design.md) are missing from the repository."}
  ],
  "spec_coverage": {"total": 16, "covered": 10, "warnings": 5, "na": 1, "uncovered": ["#4 cross-user RLS (untestable)", "#5 concurrent deletion (untested)", "#7 no-doc cascade (untested)", "#9 cases cascade (untested)", "#10 no-cases cascade (untested)", "#11 dual cascade (untested)"]},
  "test_results": {"passed": 306, "failed": 0, "regressions": false},
  "next_recommended": "fix-issues",
  "risks": [
    "CRITICAL: Production file-system errors (permissions, I/O) would prevent template deletion entirely",
    "Cascade paths (cases, dual) are untested — regressions could go undetected",
    "Missing openspec artifacts reduce traceability for future maintainers"
  ]
}
```
