# Design: Friendly Analysis Waiting UI

## Architecture Overview

Extract a reusable `AnalysisProgress` component that encapsulates all waiting-state rendering — detaching it from the monolithic `page.tsx`. The component receives derived state props and renders the appropriate UI variant. The parent (`page.tsx`) adds a single `isAnalyzing` branch and delegates rendering to `AnalysisProgress`.

## Component Tree

```
AnalysisPage (apps/web/src/app/analysis/page.tsx)
├── WizardLayout
├── Header (title + Cancel/Continue buttons)
├── Left Column: In-page Stepper
│   └── 4 sub-phase steps — updated dynamically via status
├── Right Column: Preview Panels
│   ├── Document Preview (skeleton during processing/analyzing)
│   └── Entity Extraction (skeleton during processing/analyzing)
├── [NEW] AnalysisProgress ← injected when isProcessing || isAnalyzing
│   ├── FileBadge (filename + size, always visible)
│   ├── IndeterminateProgressBar (during analyzing only)
│   ├── RotatingStatusMessage (during analyzing only, cycles every 6s)
│   ├── ElapsedTimer (during analyzing only, MM:SS)
│   └── AriaAnnouncements (phase changes only)
└── Footer (status message, encryption badges)
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `apps/web/src/components/analysis/AnalysisProgress.tsx` | **NEW** | Reusable waiting UI component |
| `apps/web/src/components/analysis/AnalysisProgress.test.tsx` | **NEW** | Unit tests for all states |
| `apps/web/src/app/analysis/page.tsx` | **MODIFIED** | Add `isAnalyzing` branch, extract skeleton/render logic to AnalysisProgress |
| `apps/web/src/app/globals.css` | **MODIFIED** | Add `@keyframes` for scan-line and pulse-dot animations |

## Component Design: `AnalysisProgress`

### Props Interface

```typescript
interface AnalysisProgressProps {
  status: "processing" | "analyzing" | "completed" | "failed" | "pending";
  progress: number;           // 0-100, only used when status === "processing"
  fileName?: string;          // from wizard state
  fileSize?: number;          // bytes, from wizard state
  /** Elapsed seconds since entering "analyzing" state (parent manages timer) */
  analyzingElapsed?: number;
  /** Rotating message index (parent manages interval) */
  currentMessageIndex?: number;
}
```

### Design Decision: State Management Location

**Decision**: The parent (`page.tsx`) owns the timer and message-cycling intervals; `AnalysisProgress` is a pure render component.

**Rationale**:
- The polling infrastructure already lives in `page.tsx` — adding another `setInterval` for messages and timer is trivial
- Keeping timers in the parent avoids duplicate cleanup logic
- `AnalysisProgress` remains testable with static props for each state snapshot

### Visual Variants

#### Variant 1: Processing (current behavior, <2s)
- Determinate progress bar with percentage
- Sub-phase 1 ✅, Sub-phase 2 spinner, Sub-phases 3-4 pending
- File badge visible
- No rotating messages, no timer

#### Variant 2: Analyzing (new, 20-30s)
- **Indeterminate progress**: A horizontal shimmer stripe (gradient) animates across the full width of the progress area. CSS keyframe `scanLine`: translates a diagonal gradient from -100% to 200% over 2s, infinite.
- **Document pulse**: The `FileText` icon in the document preview header pulses subtly (`pulse-dot` keyframe: scale 1 → 1.05 → 1 over 2s, infinite)
- **Rotating messages**: 5 messages cycling every 6s with `opacity` fade (CSS transition 500ms)
- **Elapsed timer**: `00:MM` format, top-right of the progress area
- **Sub-phases 2-4**: All show "En proceso" with `Loader2` spinner
- **File badge**: Prominent card at top

#### Variant 3: Completed
- Full results display (existing behavior)
- No progress bar, no messages, no timer
- File badge becomes part of the document preview footer

#### Variant 4: Failed
- Error message (existing behavior)
- No indeterminate animation
- Timer displays final value (frozen)

### Rotating Messages (Spanish)

```
1. "Leyendo el documento y comprendiendo su estructura..."
2. "Identificando cláusulas y secciones relevantes..."
3. "Extrayendo entidades: fechas, montos, partes involucradas..."
4. "Verificando consistencia de la información extraída..."
5. "Organizando los datos para tu revisión..."
```

Messages cycle every 6 seconds. On component mount (entering analyzing), show message 1 immediately.

### Reassurance at 30s

When `analyzingElapsed >= 30`, append a subtle note below the rotating message:
> "Los documentos extensos o complejos pueden tomar más tiempo. Esto es completamente normal."

Style: `text-xs text-text-secondary italic`, fades in with 500ms transition.

## CSS Keyframes

Added to `globals.css`:

```css
/* Indeterminate scan line for AnalysisProgress */
@keyframes scanLine {
  0%   { transform: translateX(-100%); }
  100% { transform: translateX(200%); }
}

/* Subtle pulse for document icon during analysis */
@keyframes pulseDot {
  0%, 100% { transform: scale(1); opacity: 0.7; }
  50%      { transform: scale(1.05); opacity: 1; }
}

/* Fade-in utility for status messages */
@keyframes fadeInUp {
  0%   { opacity: 0; transform: translateY(4px); }
  100% { opacity: 1; transform: translateY(0); }
}
```

Tailwind utility classes via `@theme` or inline `animation`:
- `.animate-scan-line` — applies `scanLine 2s linear infinite`
- `.animate-pulse-dot` — applies `pulseDot 2s ease-in-out infinite`
- `.animate-fade-in-up` — applies `fadeInUp 500ms ease-out`

## Derived State in page.tsx

```typescript
const isProcessing = status === "processing";
const isAnalyzing = status === "analyzing";
const showWaitingUI = isProcessing || isAnalyzing;
```

Replace the existing `isProcessing` skeleton blocks with:
```tsx
{showWaitingUI ? (
  <AnalysisProgress
    status={status}
    progress={progress}
    fileName={state.file?.name}
    fileSize={state.file?.size}
    analyzingElapsed={analyzingElapsed}
    currentMessageIndex={messageIndex}
  />
) : null}
```

The `isProcessing` (determinate) variant inside `AnalysisProgress` replaces the current inline skeleton + percentage bar.

## Timer & Message Management (parent)

Add to `page.tsx` effect that activates when `status === "analyzing"`:

```typescript
// Start elapsed timer
const timerInterval = setInterval(() => {
  setAnalyzingElapsed(prev => prev + 1);
}, 1000);

// Start message rotation
let messageIdx = 1; // start at 1 because message 0 shows immediately
const msgInterval = setInterval(() => {
  setMessageIndex(messageIdx % MESSAGES.length);
  messageIdx++;
}, 6000);
```

Cleanup: clear both intervals when `isAnalyzing` becomes false or component unmounts.

Reset `analyzingElapsed` to 0 when entering `analyzing` from non-analyzing state.

## Accessibility Strategy

| Element | ARIA | Behavior |
|---------|------|----------|
| Phase change | `aria-live="polite"` region | Announces "Analizando documento con IA" once when entering analyzing. Announces "Análisis completado" on completion. |
| Rotating messages | `aria-hidden="true"` | Visual-only; screen readers skip the carousel |
| Elapsed timer | `aria-label="Tiempo transcurrido: X segundos"` | Updates every 5s (not every second to avoid noise) |
| Progress bar (processing) | `role="progressbar" aria-valuenow={progress}` | Standard progressbar pattern |
| Progress bar (analyzing) | `role="progressbar" aria-valuetext="Procesando"` | Indeterminate — no numeric value |
| File badge | No special role | Generic text content |

## Testing Strategy (Strict TDD)

### Unit Tests: `AnalysisProgress.test.tsx`

| Test | What it verifies |
|------|-----------------|
| `renders determinate bar during processing` | Progress bar shows percentage, no indeterminate animation class |
| `renders indeterminate bar during analyzing` | Scan-line class applied, no numeric percentage |
| `shows first message immediately on analyzing mount` | Message 0 visible within first render |
| `cycles messages when index changes` | Snapshot with index 0 → snapshot with index 2 shows different text |
| `displays elapsed timer in MM:SS` | `elapsed=5` → "00:05", `elapsed=65` → "01:05" |
| `renders file badge with name and size` | Badge visible with filename text |
| `stops indeterminate on completed` | status="completed" → no scan-line class |
| `shows reassurance text at 30s` | elapsed=30 → reassurance message visible |
| `aria-live announces phase change` | Status prop change triggers aria-live text update |
| `rotating messages are aria-hidden` | Message element has `aria-hidden="true"` |

### Integration: Existing tests

No existing tests broken — the extraction is additive. The `page.tsx` modifications replace inline JSX with a component call; existing E2E tests that wait for "Análisis completado" title will continue working since the header title logic is unchanged.

## Stitch Screens (Design Reference)

Generate 3 screens in project `13244395666194572658`:

1. **Analysis Waiting — 5s elapsed** (`prompt`: "A legal document analysis screen showing a friendly waiting state. Left sidebar has a stepper with 4 steps: step 1 completed (Validando archivo), steps 2-4 show 'En proceso' with spinner. An indeterminate shimmer progress bar is visible. A rotating message says 'Leyendo el documento y comprendiendo su estructura...'. A timer shows '00:05'. A file badge shows 'contrato-alquiler.pdf · 2.4 MB'. Design tokens: Literata headlines, Source Serif 4 body, accent #3d6b8f, background #f5f1e8. Professional legal tech aesthetic.")

2. **Analysis Waiting — 25s elapsed** (`prompt`: "Same analysis screen as before but now at 25 seconds elapsed. The rotating message now says 'Extrayendo entidades: fechas, montos, partes involucradas...'. Timer shows '00:25'. A subtle reassurance note appears below: 'Los documentos extensos o complejos pueden tomar más tiempo. Esto es completamente normal.' Keep the same layout and design tokens.")

3. **Analysis Waiting — Full page view** (`prompt`: "Full page view of the analysis waiting screen with both columns visible. Left: stepper + file badge + progress bar + rotating message. Right: document preview section with pulsing skeleton placeholders and entity extraction section with skeleton fields. The document icon in the preview header has a subtle pulse animation. Design tokens: Literata headlines, Source Serif 4 body, accent #3d6b8f, surface #fdfcf9, background #f5f1e8.")

## Implementation Order

1. Generate Stitch screens (design reference)
2. Write unit tests for `AnalysisProgress` component (TDD)
3. Implement `AnalysisProgress` component
4. Add CSS keyframes to `globals.css`
5. Add timer/message state management to `page.tsx`
6. Replace inline skeleton/processing blocks with `AnalysisProgress` component
7. Run full test suite
8. Manual E2E verification

## Rollback

All changes are frontend-only. Rollback:
1. Revert `AnalysisProgress.tsx` and test file
2. Restore inline JSX in `page.tsx`
3. Remove CSS keyframes from `globals.css`
4. Remove timer/message state from `page.tsx`
