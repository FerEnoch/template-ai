# Design: Fix Analysis Error Chain

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Next.js)                             │
│  page.tsx                                                             │
│  ┌──────────────────────┐   ┌──────────────────────────────────────┐ │
│  │ Upload file           │   │ Poll /status + trigger progress      │ │
│  │ POST /upload          │   │ GET /:id/status ← lightweight        │ │
│  │                       │   │ GET /:id        ← advances progress  │ │
│  └──────────────────────┘   └──────────────────────────────────────┘ │
└──────────────────────────────┬───────────────────────────────────────┘
                               │ HTTP
┌──────────────────────────────▼───────────────────────────────────────┐
│                         BACKEND (NestJS)                               │
│                                                                       │
│  OpenRouterService                                                    │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │ callModel()                                                      │ │
│  │ ├─ try/catch around JSON.parse (B1) ← PROTECTED                  │ │
│  │ ├─ SyntaxError → INVALID_RESPONSE (B2) ← CORRECT CLASSIFICATION  │ │
│  │ ├─ 429 → RATE_LIMIT | 401 → CONFIG_ERROR | conn → NETWORK_ERROR  │ │
│  │ └─ maxTokens: 8192 (B4) ← ROOT CAUSE FIX                         │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  DocumentAnalysisService                                              │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │ callAiWithRetry()                                                │ │
│  │ ├─ Retry: RATE_LIMIT | NETWORK_ERROR | INVALID_RESPONSE (B3)     │ │
│  │ ├─ 3 attempts max with exponential backoff                       │ │
│  │ └─ CONFIG_ERROR → no retry (permanent)                           │ │
│  └─────────────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────────┘
```

## Data Flow: Before vs After

### Before (Broken)
```
1. Frontend polls GET /:id every 800ms
   → Each call: Phase 1 (increment progress +25)
   → Call 4: progress=100 → AI triggered → blocks 10-30s
   → AI response JSON truncated (maxTokens=4096)
     → JSON.parse() SyntaxError 💥
       → Misclassified as NETWORK_ERROR
         → Not retried (only RATE_LIMIT triggers retry)
           → Status set to "failed", progress=100
2. Frontend receives {status: "failed", progress: 100}
   → clearInterval ✓
   → setError("El análisis falló.") ✓
   → setAnalysisResult(result) ✗ MISSING
3. analysisResult retains stale {progress:75, status:"processing"}
   → isProcessing = true (stuck)
   → Progress bar frozen at 75%
   → "Extrayendo texto... en proceso" persists forever
4. Concurrent in-flight callbacks may re-establish isProcessing=true
```

### After (Fixed)
```
1. Frontend calls GET /:id to advance progress (+25 each call)
   → Polls GET /:id/status for monitoring (read-only, no log spam)
2. Backend AI call with maxTokens=8192
   → JSON response fits within budget
   → OR: truncated → JSON.parse caught → INVALID_RESPONSE
     → Retry up to 3 times (with backoff)
     → After 3 failures → status="failed"
3. Frontend receives status="failed" via /status
   → clearInterval ✓
   → setAnalysisResult(failedResult) ✓ ← FIXED
   → setError("El análisis falló.") ✓
4. isProcessing = false ← UI unfreezes
   → Progress bar disappears
   → Stepper shows failed state
   → Error message in footer visible
5. Race condition guarded: isStaleRef prevents stale callbacks
```

## Detailed Changes

### Fix B4 (Root Cause) — Token Budget

**File**: `apps/api/src/config/ai.ts` (18 lines → ~23 lines)

**Current** (line 10):
```typescript
maxTokens: 4096,
```

**New**:
```typescript
const maxTokensEnv = process.env.AI_MAX_TOKENS
  ? parseInt(process.env.AI_MAX_TOKENS, 10)
  : 8192;

if (Number.isNaN(maxTokensEnv) || maxTokensEnv < 8192) {
  throw new Error(
    `AI_MAX_TOKENS must be at least 8192 (got: ${process.env.AI_MAX_TOKENS ?? "unset"}). ` +
    `Lower values risk JSON truncation on large documents.`
  );
}

export const AI_CONFIG = {
  model: process.env.AI_MODEL,
  modelFallback: process.env.AI_MODEL_FALLBACK,
  apiKey: env.OPENROUTER_API_KEY,
  maxTokens: maxTokensEnv,
  temperature: 0.1,
} as const;
```

**Rationale**: 4096 is shared between the system prompt (~2000 chars of Spanish instructions + few-shot examples), the user document (3-5 pages can be 5000+ chars), and the AI response JSON. This overflow causes the AI response to be truncated mid-JSON, triggering the entire failure chain. 8192 provides headroom for most documents; larger docs can override via `AI_MAX_TOKENS=16384`.

Validation at import time (module-level) ensures fail-fast before any requests are served — consistent with existing `OPENROUTER_API_KEY` validation pattern.

---

### Fix B1 — JSON Parse Safety

**File**: `apps/api/src/ai/open-router.service.ts`, lines 192-193

**Current**:
```typescript
const rawResponse = response.choices[0]?.message?.content ?? "";
const parsed = JSON.parse(rawResponse);
```

**New**:
```typescript
const rawResponse = response.choices[0]?.message?.content ?? "";

// Attempt to strip markdown fences (some models wrap JSON in ```json)
const stripMarkdownFences = (text: string): string => {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/);
  return fenceMatch ? fenceMatch[1].trim() : trimmed;
};

let parsed: unknown;
try {
  parsed = JSON.parse(stripMarkdownFences(rawResponse));
} catch (parseError) {
  this.logger.error(
    `Invalid JSON from model ${model}: ${(parseError as Error).message}`,
  );
  this.logger.debug(
    `Raw response (first 1000 chars): ${rawResponse.substring(0, 1000)}`,
  );
  throw new OpenRouterError(
    `Invalid JSON response from ${model}: ${(parseError as Error).message}`,
    "INVALID_RESPONSE",
  );
}
```

**Rationale**: `JSON.parse()` without try/catch is a crash vector. The markdown fence strip handles models that wrap JSON in `\`\`\`json` blocks despite `json_schema` mode. The debug log captures the raw response for post-mortem analysis. Error is classified as `INVALID_RESPONSE` (not raw SyntaxError) so the retry system can handle it correctly.

---

### Fix B2 — Error Classification Safety Net

**File**: `apps/api/src/ai/open-router.service.ts`, lines 221-222 (inside catch block)

**Current**:
```typescript
} catch (error) {
  if (error instanceof OpenRouterError) {
    throw error;
  }
  // Check for API errors...
  const status = (error as { status?: number })?.status ?? 0;
```

**New** — add SyntaxError guard before status-based classification:
```typescript
} catch (error) {
  if (error instanceof OpenRouterError) {
    throw error;
  }

  // Safety net: catch any SyntaxError that escapes JSON.parse protection.
  // Should not happen after B1, but guards against future regressions.
  if (error instanceof SyntaxError) {
    this.logger.error(
      `Unprotected JSON.parse failed: ${error.message}`,
    );
    throw new OpenRouterError(
      `Invalid JSON response: ${error.message}`,
      "INVALID_RESPONSE",
    );
  }

  // Check for API errors...
  const status = (error as { status?: number })?.status ?? 0;
```

**Rationale**: With B1, SyntaxError should never reach this catch block (it's caught and re-thrown as OpenRouterError). This guard is a defense-in-depth measure — if any future code path adds an unprotected `JSON.parse`, it won't be silently misclassified as `NETWORK_ERROR`. The existing status-based classification (401→AUTH_ERROR, 404→MODEL_NOT_FOUND, 429→RATE_LIMIT, 0→NETWORK_ERROR) remains unchanged and correct for transport-layer errors.

---

### Fix B3 — Expanded Retry Policy

**File**: `apps/api/src/ai/document-analysis.service.ts`, lines 116-145

**Current** (lines 116-145):
```typescript
private async callAiWithRetry(fileContent: string) {
    const delays = [2_000, 5_000]; // 2s, then 5s between retries
    let lastError: unknown;

    for (let attempt = 0; attempt <= delays.length; attempt++) {
      try {
        if (attempt > 0) {
          const delay = delays[attempt - 1];
          console.warn(
            `[DocumentAnalysisService] AI rate limited — retrying in ${delay / 1000}s (attempt ${attempt})...`,
          );
          await sleep(delay);
        }
        return await this.openRouterService.extractEntities(fileContent);
      } catch (error) {
        lastError = error;
        // Only retry on rate limit errors
        if (
          error instanceof OpenRouterError &&
          error.code === "RATE_LIMIT" &&
          attempt < delays.length
        ) {
          continue;
        }
        throw error;
      }
    }

    throw lastError;
  }
```

**New**:
```typescript
private async callAiWithRetry(fileContent: string) {
    // Retryable error codes (per ai-error-resilience spec)
    const retryableCodes = ["RATE_LIMIT", "NETWORK_ERROR", "INVALID_RESPONSE"];
    // Exponential-ish backoff: 1s, 3s → 3 total attempts
    const delays = [1_000, 3_000];
    let lastError: unknown;

    for (let attempt = 0; attempt <= delays.length; attempt++) {
      try {
        if (attempt > 0) {
          const delay = delays[attempt - 1];
          console.warn(
            `[DocumentAnalysisService] AI call failed (attempt ${attempt}) — retrying in ${delay / 1000}s...`,
          );
          await sleep(delay);
        }
        return await this.openRouterService.extractEntities(fileContent);
      } catch (error) {
        lastError = error;
        if (
          error instanceof OpenRouterError &&
          retryableCodes.includes(error.code) &&
          attempt < delays.length
        ) {
          continue;
        }
        throw error;
      }
    }

    throw lastError;
  }
```

**Rationale**: `INVALID_RESPONSE` (from truncated/malformed JSON) and `NETWORK_ERROR` (transient connectivity) are now retried — honoring the `ai-integration` spec requirement for up to 3 retries. `CONFIG_ERROR` (invalid API key, model not found) is NOT retried — permanent failures should fail fast. `RATE_LIMIT` continues to be retried as before.

Backoff changed from 2s/5s to 1s/3s — faster feedback for transient errors while still providing spacing between attempts. Total: 3 attempts (initial + 2 retries), matching the spec's "up to 3 consecutive attempts".

---

### Fix B5 — Failed State Handling (CRITICAL)

**File**: `apps/web/src/app/analysis/page.tsx`, lines 148-151

**Current**:
```typescript
} else if (result.status === "failed") {
    clearInterval(interval);
    setError("El análisis falló. Intentá de nuevo.");
    setIsUploading(false);
}
```

**New**:
```typescript
} else if (result.status === "failed") {
    clearInterval(interval);
    setAnalysisResult(result);  // ← FIX: update state so isProcessing becomes false
    setError("El análisis falló. Intentá de nuevo.");
    setIsUploading(false);
}
```

**Rationale**: This single missing line is the entire reason the UI freezes. Without `setAnalysisResult(result)`, the `analysisResult` state retains the previous poll's value (e.g., `{progress: 75, status: "processing"}`). The derived variable `isProcessing` (line 230) checks `status === "processing" || status === "analyzing"` — with the stale status, it stays `true`. This causes:

1. **Progress bar** (line 407): Renders because `isProcessing` is true, shows 75%
2. **Stepper Step 2** (line 331-342): Shows "En proceso..." instead of a failed state
3. **Document preview** (line 473): Shows skeleton loaders instead of error state
4. **Entity extraction** (line 564): Shows skeleton loaders

Calling `setAnalysisResult(result)` with `{status: "failed", progress: 100, ...}` makes `isProcessing` become `false`, which unblocks ALL of the above. The error message in the footer (line 631) already renders correctly — it just wasn't paired with the UI state transition.

---

### Fix B6 + Race Condition — Polling Endpoint Switch with Stale Guard

**File**: `apps/web/src/app/analysis/page.tsx`, lines 121-176

This is the most substantial change. The current code polls the heavy `GET /:id` endpoint (which mutates progress) on every 800ms tick. The fix switches to the lightweight `GET /:id/status` endpoint for monitoring, while still calling `GET /:id` to advance the progress pipeline. A `useRef` guard prevents stale callbacks from mutating state after cleanup.

**Current** (lines 121-176):
```typescript
const pollForAnalysis = useCallback(
    (documentId: string) => {
      let attempt = 0;
      const startedAt = Date.now();

      const interval = setInterval(async () => {
        attempt++;
        try {
          const response = await fetch(`/api/analysis/${documentId}`);  // ← HEAVY
          // ... handles completed/failed/else ...
        } catch {
          clearInterval(interval);
          setError("Error de conexión");
          setIsUploading(false);
        }
      }, POLLING_INTERVAL_MS);

      return () => clearInterval(interval);
    },
    [state.file, setWizardAnalysisResult],
  );
```

**New** — replaces lines 121-176:
```typescript
const pollForAnalysis = useCallback(
    (documentId: string) => {
      let attempt = 0;
      const startedAt = Date.now();
      const isStaleRef = { current: false };  // race condition guard
      let progressTriggerActive = false;       // prevent concurrent /:id calls

      // Helper: call /:id to advance progress (outside the polling loop)
      const triggerProgress = async () => {
        if (progressTriggerActive || isStaleRef.current) return;
        progressTriggerActive = true;
        try {
          const response = await fetch(`/api/analysis/${documentId}`);
          if (!response.ok || isStaleRef.current) return;
          const result: AnalysisResult = await response.json();
          if (isStaleRef.current) return;

          // If this call completed the analysis (status is terminal), handle immediately
          if (result.status === "completed") {
            isStaleRef.current = true;
            clearInterval(interval);
            setAnalysisResult(result);
            setWarning(null);
            setWizardAnalysisResult(documentId, result.entities);
            saveDraft(state.file!, documentId, result.entities);
            setIsUploading(false);
            return;
          }
          if (result.status === "failed") {
            isStaleRef.current = true;
            clearInterval(interval);
            setAnalysisResult(result);
            setError("El análisis falló. Intentá de nuevo.");
            setIsUploading(false);
            return;
          }
          // Otherwise: progress was incremented, keep polling
        } catch {
          // Network error during trigger — will retry on next poll cycle
        } finally {
          progressTriggerActive = false;
        }
      };

      // Main polling loop: monitors status via lightweight endpoint
      const interval = setInterval(async () => {
        if (isStaleRef.current) return;  // guard: cleared or unmounted
        attempt++;

        try {
          const response = await fetch(`/api/analysis/${documentId}/status`);
          if (!response.ok) {
            clearInterval(interval);
            setError(`Error del servidor (${response.status})`);
            setIsUploading(false);
            return;
          }

          const statusData: { documentId: string; status: string; progress: number } =
            await response.json();

          if (isStaleRef.current) return;  // re-check after await

          if (statusData.status === "completed") {
            clearInterval(interval);
            // Fetch full result ONCE
            const fullResponse = await fetch(`/api/analysis/${documentId}`);
            const fullResult: AnalysisResult = await fullResponse.json();
            if (!isStaleRef.current) {
              setAnalysisResult(fullResult);
              setWarning(null);
              setWizardAnalysisResult(documentId, fullResult.entities);
              saveDraft(state.file!, documentId, fullResult.entities);
              setIsUploading(false);
            }
          } else if (statusData.status === "failed") {
            clearInterval(interval);
            // Build minimal AnalysisResult for failed state transition
            const failedResult: AnalysisResult = {
              documentId,
              status: "failed",
              progress: statusData.progress,
              entities: [],
              extractedText: null,
            };
            if (!isStaleRef.current) {
              setAnalysisResult(failedResult);  // ← B5 fix: update state
              setError("El análisis falló. Intentá de nuevo.");
              setIsUploading(false);
            }
          } else {
            // Still processing — check timeouts and trigger progress if needed
            const elapsed = Date.now() - startedAt;
            if (elapsed > MAX_POLLING_TIME_MS) {
              setWarning("El análisis está tardando más de lo esperado. Seguimos intentando...");
            }
            if (attempt >= MAX_POLLING_ATTEMPTS) {
              clearInterval(interval);
              setError("El análisis está tardando demasiado. Intentá de nuevo.");
              setIsUploading(false);
              return;
            }

            // Update progress bar with status data
            if (!isStaleRef.current) {
              setAnalysisResult((prev) =>
                prev
                  ? { ...prev, status: statusData.status, progress: statusData.progress }
                  : {
                      documentId,
                      status: statusData.status,
                      progress: statusData.progress,
                      entities: [],
                      extractedText: null,
                    },
              );
              setPollingAttempts(attempt);
            }

            // Advance the backend pipeline by calling /:id if progress < 100
            if (statusData.status === "processing" && statusData.progress < 100) {
              triggerProgress();
            }
          }
        } catch {
          if (!isStaleRef.current) {
            clearInterval(interval);
            setError("Error de conexión");
            setIsUploading(false);
          }
        }
      }, POLLING_INTERVAL_MS);

      // Fire initial progress trigger immediately (without waiting for first poll)
      triggerProgress();

      // Cleanup: mark stale → prevents in-flight callbacks from mutating state
      return () => {
        isStaleRef.current = true;
        clearInterval(interval);
      };
    },
    [state.file, setWizardAnalysisResult],
  );
```

**Rationale for the split approach**:
- **`/status` polling**: Read-only, fast (<30ms), no log spam. Used for monitoring and UI updates.
- **`/:id` trigger**: Called when progress < 100 to advance the pipeline (+25 each call). Only one trigger runs at a time (`progressTriggerActive` guard). If the trigger call completes the analysis (returns terminal status), it handles it immediately without waiting for the next poll cycle.
- **`isStaleRef` guard**: Set to `true` in the cleanup function. Checked before every `setState` call and after every `await`. This prevents the race condition where in-flight callbacks mutate state after `clearInterval` or component unmount.
- **Initial trigger**: `triggerProgress()` is called immediately after setting up the interval, so the first progress increment happens without waiting 800ms.

---

## Testing Strategy

### Unit Tests (Vitest)

| Test | File | What it verifies |
|------|------|-----------------|
| `JSON.parse wraps SyntaxError as INVALID_RESPONSE` | `open-router.service.spec.ts` | B1 — try/catch safety |
| `SyntaxError is not classified as NETWORK_ERROR` | `open-router.service.spec.ts` | B2 — error classification |
| `Retry on INVALID_RESPONSE` | `document-analysis.service.spec.ts` | B3 — expanded retry |
| `Retry on NETWORK_ERROR` | `document-analysis.service.spec.ts` | B3 — expanded retry |
| `No retry on CONFIG_ERROR` | `document-analysis.service.spec.ts` | B3 — permanent failure |
| `Max 3 retries enforced` | `document-analysis.service.spec.ts` | B3 — retry cap |
| `maxTokens defaults to 8192` | `ai.spec.ts` (new or extend existing) | B4 — token budget |
| `maxTokens < 8192 rejected at bootstrap` | `ai.spec.ts` | B4 — validation |

### Integration Tests

| Test | What it verifies |
|------|-----------------|
| Malformed AI JSON → status transitions to "failed" after retries | End-to-end error path |
| Valid AI response within 8192 token budget → completes normally | Happy path not broken |
| `/status` endpoint returns correct progress without mutations | Lightweight endpoint integrity |

### Manual E2E Verification

1. Upload a 3-5 page PDF → verify analysis completes (no freeze at 75%)
2. Simulate truncated AI response → verify retry up to 3 times → "failed" status
3. Verify "El análisis falló" message appears and stepper exits "En proceso..." state
4. Verify no "SyntaxError" unhandled exceptions in API logs
5. Rapid page navigation during polling → verify no stale state updates

---

## Files Changed Summary

| File | Action | Lines Changed | Description |
|------|--------|--------------|-------------|
| `apps/api/src/config/ai.ts` | Modify | ~8 | `maxTokens`: 4096 → env-configurable, default 8192, validation |
| `apps/api/src/ai/open-router.service.ts` | Modify | ~12 | JSON.parse try/catch + markdown fence strip (B1), SyntaxError guard (B2) |
| `apps/api/src/ai/document-analysis.service.ts` | Modify | ~5 | Expand retry to 3 error codes, 1s/3s backoff (B3) |
| `apps/web/src/app/analysis/page.tsx` | Modify | ~90 | Polling refactor (B6), failed state update (B5), race guard, initial trigger |
| `apps/api/src/config/ai.spec.ts` | Create | ~25 | Token budget validation tests (B4) |
| **Total estimated** | | **~140 lines** | Within 400-line review budget |

## Rollback Plan

1. **Backend**: Revert `maxTokens` to 4096, remove JSON.parse try/catch, narrow retry to RATE_LIMIT — all in 3 files, ~20 lines
2. **Frontend**: Revert `pollForAnalysis` to original implementation — 1 function, ~55 lines
3. All changes are backward compatible; no DB migrations involved; `extractedText` column already exists from migration 0006
