# Design: Fix Analysis Polling and Document Preview

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Next.js)                        │
│  page.tsx                                                        │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────────────┐ │
│  │ Upload file   │──▶│ Poll /status  │──▶│ Fetch full result    │ │
│  │ POST /upload  │   │ GET /:id/     │   │ GET /:id (once)      │ │
│  │               │   │   status      │   │ + Render preview     │ │
│  └──────────────┘   └──────────────┘   └──────────────────────┘ │
└───────────────────────────┬─────────────────────────────────────┘
                            │ HTTP
┌───────────────────────────▼─────────────────────────────────────┐
│                      BACKEND (NestJS)                            │
│                                                                  │
│  AnalysisController                                              │
│  ┌─────────────────────┐  ┌──────────────────────────────────┐  │
│  │ GET /:id/status     │  │ GET /:id                          │  │
│  │ (read-only, fast)   │  │ Phase 1 → Phase 2(AI) → Phase 3  │  │
│  └─────────────────────┘  └──────────────────────────────────┘  │
│              │                          │                         │
│  AnalysisService                       │                         │
│  ┌──────────────────────┐              │                         │
│  │ getStatus()          │              │                         │
│  │ → SELECT ONLY        │              │                         │
│  └──────────────────────┘              │                         │
│                                        │                         │
│  DocumentAnalysisService               │                         │
│  ┌──────────────────────────────────────┐                       │
│  │ analyze(filePath)                    │                       │
│  │ → extractText() → AI call           │                       │
│  │ → returns { entities, extractedText }│                       │
│  └──────────────────────────────────────┘                       │
└──────────────────────────────────────────────────────────────────┘
```

## Data Flow: Before vs After

### Before (Broken)
```
Frontend polls GET /:id every 800ms
  → Each call: Phase 1 (logs, increments progress) 
  → Flood of duplicate logs
  → Heavy endpoint blocks for 10-30s on AI call
  → Timeout at 16s (20 attempts)
  → Preview: skeleton wireframes only
```

### After (Fixed)
```
1. Upload → POST /documents/upload → returns { id }
2. Trigger → GET /:id (once) → starts analysis pipeline
3. Poll → GET /:id/status every 800ms (read-only, fast)
   → Returns { status, progress } — no DB mutations
4. On status=completed → GET /:id (once more) → full result with entities + extractedText
5. Preview renders extractedText with entity highlights
```

## Detailed Changes

### Change 1: Frontend Polling Refactor
**File**: `apps/web/src/app/analysis/page.tsx`

| # | Line(s) | Current | New |
|---|---------|---------|-----|
| 1 | 22 | `const MAX_POLLING_ATTEMPTS = 20;` | `const MAX_POLLING_ATTEMPTS = 60;` |
| 2 | New | — | `const MAX_POLLING_TIME_MS = 55_000;` (elapsed-time fallback) |
| 3 | 118 | `fetch(\`/api/analysis/${documentId}\`)` | `fetch(\`/api/analysis/${documentId}/status\`)` |
| 4 | 126-127 | Parses response as `AnalysisResult` | Parses as `AnalysisStatus` (only status/progress) |
| 5 | 129-133 | On completed: sets result directly | On completed: fetch full result once, then set |
| 6 | 139-141 | Timeout error at MAX_ATTEMPTS | Two-tier: elapsed-time shows "still analyzing", attempt-count shows error |
| 7 | 60-110 | useEffect cleanup only sets `cancelled` flag | Add `clearInterval` for any pending polling interval |
| 8 | 423-447 | Skeleton wireframes | Real extractedText rendering (see Change 3) |

**Pseudocode for new polling logic**:
```typescript
const pollForAnalysis = (documentId: string) => {
  let attempt = 0;
  const startedAt = Date.now();
  const interval = setInterval(async () => {
    attempt++;
    try {
      const response = await fetch(`/api/analysis/${documentId}/status`);
      if (!response.ok) { /* error handling */ }
      
      const status: { documentId: string; status: string; progress: number } = await response.json();
      
      if (status.status === "completed") {
        clearInterval(interval);
        // Fetch full result ONCE
        const fullResponse = await fetch(`/api/analysis/${documentId}`);
        const result: AnalysisResult = await fullResponse.json();
        setAnalysisResult(result);
        // ... save to wizard, setIsUploading(false)
      } else if (status.status === "failed") {
        clearInterval(interval);
        setError("El análisis falló.");
      } else {
        const elapsed = Date.now() - startedAt;
        if (elapsed > MAX_POLLING_TIME_MS) {
          clearInterval(interval);
          setError("El análisis está tardando demasiado. Intentá de nuevo.");
        } else if (attempt >= MAX_POLLING_ATTEMPTS) {
          // Safety net: should not be reached if elapsed-time catches it first
          clearInterval(interval);
          setError("El análisis está tardando demasiado.");
        }
        setPollingAttempts(attempt);
      }
    } catch { /* error handling */ }
  }, POLLING_INTERVAL_MS);
  
  // Store interval ref for cleanup
  return interval;
};
```

### Change 2: Database Migration
**File**: `apps/api/src/infrastructure/postgres/migrations/0006_extracted_text.sql` (NEW)

```sql
-- Migration: 0006_extracted_text.sql
-- Purpose: Add extracted_text column to analysis_results for document preview.
-- The column stores the raw text extracted from PDF/DOCX files before AI analysis.
-- NULL means: old record (pre-migration) OR text extraction failed.

ALTER TABLE analysis_results
  ADD COLUMN IF NOT EXISTS extracted_text TEXT;
```

Column is `TEXT` (nullable, no default) — backward compatible. Existing rows get `NULL`.

### Change 3: Repository Layer
**File**: `apps/api/src/infrastructure/postgres/repositories/analysis-results.repository.ts`

**3a) Update `AnalysisResultRecord` interface** (line 7-11):
```typescript
export interface AnalysisResultRecord {
  // ... existing fields ...
  extractedText: string | null;  // NEW
}
```

**3b) Update `rowToAnalysisResult`** (line 19-30):
```typescript
function rowToAnalysisResult(row: Record<string, unknown>): AnalysisResultRecord {
  return {
    // ... existing fields ...
    extractedText: (row["extracted_text"] as string | null) ?? null,  // NEW
  };
}
```

**3c) Update all SELECT queries** to include `extracted_text`:
- `findById` (line 55): Add `extracted_text` to column list
- `findByDocumentId` (line 72): Add `extracted_text`
- `incrementProgress` (line 91): Add `extracted_text` to RETURNING
- `atomicTransitionToAnalyzing` (line 116): Add `extracted_text` to RETURNING
- `updateStatus` (line 134): Add `extracted_text` to RETURNING
- `incrementRetryCount` (line 158): Add `extracted_text` to RETURNING
- `create` (line 40): Add `extracted_text` to RETURNING

**3d) Add `saveExtractedText` method**:
```typescript
async saveExtractedText(id: string, extractedText: string): Promise<void> {
  await this.client.query(
    `UPDATE analysis_results SET extracted_text = $2 WHERE id = $1`,
    [id, extractedText],
  );
}
```

### Change 4: DocumentAnalysisService
**File**: `apps/api/src/ai/document-analysis.service.ts`

**4a) Update `AnalyzeResult` interface** (line 8-17):
```typescript
export interface AnalyzeResult {
  success: boolean;
  extractedText?: string;  // NEW — raw text extracted from file
  entities?: Array<{ /* ... existing ... */ }>;
  error?: string;
}
```

**4b) Update `analyze()` method** (line 67-105):
After successful text extraction (line 79), capture the text:
```typescript
// After extractText succeeds:
fileContent = await this.extractText(filePath);

// After AI call succeeds:
return {
  success: true,
  extractedText: fileContent,  // NEW — pass extracted text upstream
  entities: aiResult.entities.map(/* ... */),
};
```

### Change 5: AnalysisService
**File**: `apps/api/src/analysis/analysis.service.ts`

**5a) Update `AnalysisResult` interface** (line 12-19):
```typescript
export interface AnalysisResult {
  // ... existing fields ...
  extractedText: string | null;  // NEW
}
```

**5b) Update Phase 2/3 in `getFullResult()`** (line 144-197):
After AI call succeeds:
```typescript
const aiResult = await this.documentAnalysisService.analyze(document?.filePath ?? null);
// aiResult now includes extractedText
```

In Phase 3 (success path, line 170-197):
```typescript
// After inserting entities:
if (aiResult.extractedText) {
  await analysisRepo.saveExtractedText(phase1Result.analysisResultId, aiResult.extractedText);
}
```

**5c) Update `mapToAnalysisResult`** (line 241-262):
```typescript
return {
  // ... existing fields ...
  extractedText: record.extractedText,  // NEW
};
```

### Change 6: Contracts
**File**: `packages/contracts/src/schemas.ts`

**6a) Update `AnalysisResultSchema`** (line 36-43):
```typescript
export const AnalysisResultSchema = z.object({
  documentId: z.string().uuid(),
  status: z.enum(["pending", "processing", "analyzing", "completed", "failed"]),
  entities: z.array(EntitySchema),
  progress: z.number().min(0).max(100),
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
  extractedText: z.string().nullable(),  // NEW — null for old records
});
```

### Change 7: Frontend Preview Rendering
**File**: `apps/web/src/app/analysis/page.tsx`

Replace skeleton wireframes (lines 423-447) with real content:

```tsx
{isProcessing ? (
  /* Existing skeleton/pulse loading — kept for during analysis */
  <>...</>
) : isCompleted && analysisResult ? (
  /* NEW: Real preview with extracted text */
  analysisResult.extractedText ? (
    <div className="space-y-4">
      {/* Extracted text with entity highlights */}
      <div className="prose prose-sm max-w-none whitespace-pre-wrap font-body text-sm leading-relaxed text-text-primary">
        {renderHighlightedText(analysisResult.extractedText, analysisResult.entities)}
      </div>
      {state.file && (
        <div className="rounded-lg border border-border bg-background p-4">
          <p className="text-xs font-medium text-text-primary">{state.file.name}</p>
          <p className="text-xs text-text-secondary">{formatBytes(state.file.size)}</p>
        </div>
      )}
    </div>
  ) : (
    /* Graceful fallback for old records without extractedText */
    <div className="flex h-full flex-col items-center justify-center gap-3">
      <FileText className="h-8 w-8 text-text-disabled" />
      <p className="text-sm text-text-secondary">Vista previa no disponible para este documento</p>
      {state.file && (
        <div className="rounded-lg border border-border bg-background p-4">
          <p className="text-xs font-medium text-text-primary">{state.file.name}</p>
          <p className="text-xs text-text-secondary">{formatBytes(state.file.size)}</p>
        </div>
      )}
    </div>
  )
) : (
  /* Existing skeleton — when not processing and not completed */}
  <>...</>
)}
```

The `renderHighlightedText` function:
```typescript
function renderHighlightedText(text: string, entities: Entity[]): React.ReactNode {
  // Sort entities by sourceSpan.start
  const sorted = entities
    .filter(e => e.sourceSpan)
    .sort((a, b) => (a.sourceSpan!.start - b.sourceSpan!.start));
  
  const segments: React.ReactNode[] = [];
  let lastEnd = 0;
  
  for (const entity of sorted) {
    const span = entity.sourceSpan!;
    // Add non-highlighted text before this entity
    if (span.start > lastEnd) {
      segments.push(text.slice(lastEnd, span.start));
    }
    // Add highlighted entity span
    const colorClass = entity.confidence === "ALTA" ? "bg-success/20" : "bg-warning/20";
    segments.push(
      <mark key={entity.id} className={`rounded px-0.5 ${colorClass}`} title={`${entity.label}: ${entity.value}`}>
        {text.slice(span.start, span.end)}
      </mark>
    );
    lastEnd = span.end;
  }
  // Add remaining text
  if (lastEnd < text.length) {
    segments.push(text.slice(lastEnd));
  }
  
  return <>{segments}</>;
}
```

## Testing Strategy

### Unit Tests (Vitest)
| Test | File | What it verifies |
|------|------|-----------------|
| `getStatus returns read-only state` | `analysis.service.spec.ts` | Status endpoint doesn't mutate DB |
| `getFullResult includes extractedText` | `analysis.service.spec.ts` | New field in response |
| `saveExtractedText persists text` | `analysis-results.repository.spec.ts` | Repository writes column |
| `AnalyzeResult includes extractedText` | `document-analysis.service.spec.ts` | Service returns text |
| `AnalysisResultSchema validates extractedText` | `contracts` test | Nullable string accepted |

### Integration Tests
| Test | What it verifies |
|------|-----------------|
| Poll `/status` → see progress | Lightweight endpoint works |
| Poll `/status` → completed → fetch full result | End-to-end flow |
| Old analysis (NULL extractedText) returns gracefully | Backward compatibility |
| 60 polls without timeout | Extended timeout works |

### Manual E2E Verification
1. Upload a PDF → verify `/status` polling (no duplicate Phase 1 logs)
2. Wait for completion → verify no timeout error
3. Verify preview shows highlighted extracted text
4. Check old document (pre-migration) shows "Preview unavailable"

## Files Changed Summary

| File | Action | Lines Changed |
|------|--------|--------------|
| `apps/web/src/app/analysis/page.tsx` | Modify | ~80 lines (polling refactor + preview rendering) |
| `packages/contracts/src/schemas.ts` | Modify | 1 line (add `extractedText` field) |
| `apps/api/src/ai/document-analysis.service.ts` | Modify | ~5 lines (add `extractedText` to result) |
| `apps/api/src/analysis/analysis.service.ts` | Modify | ~15 lines (interface + save text + map) |
| `apps/api/src/infrastructure/postgres/repositories/analysis-results.repository.ts` | Modify | ~30 lines (interface + queries + new method) |
| `apps/api/src/infrastructure/postgres/migrations/0006_extracted_text.sql` | **New** | 5 lines |
| **Total estimated** | | **~136 lines** |
