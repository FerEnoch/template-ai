# Exploration: Friendly Analysis Waiting UI

## Current State

The analysis page (`apps/web/src/app/analysis/page.tsx`) drives a polling-based analysis flow with two API endpoints:

- **`GET /api/analysis/:id/status`** — lightweight poll (every 800ms) returning `{ documentId, status, progress }`. Status transitions: `pending → processing → analyzing → completed | failed`.
- **`GET /api/analysis/:id`** — full result endpoint. Each call increments progress by ~25. When progress reaches 100, one request triggers the AI phase (10-30s). Returns `{ documentId, status, progress, entities[], extractedText }`.

The backend analysis has **three phases**:

1. **Phase 1** (short transaction, ~200ms per call): Increment progress by 25, repeat until progress=100, then atomic transition to `analyzing`.
2. **Phase 2** (outside transaction, 10-30s): Extract text from file + call OpenRouter AI to extract entities. This is the bottleneck.
3. **Phase 3** (short transaction): Insert entities, mark `completed`.

The frontend treats `status === "processing"` and `status === "analyzing"` identically as `isProcessing`, showing the same skeleton loaders and stepper state for both phases.

## Affected Areas

### Frontend (primary change target)
- **`apps/web/src/app/analysis/page.tsx`** (761 lines) — The main analysis page. Contains all polling logic, the stepper sidebar, skeleton loaders, progress bar, document preview panel, and entity extraction panel. This is where the waiting UI lives.
- **`apps/web/src/components/wizard/WizardLayout.tsx`** — Wizard shell with shared StepIndicator. Could gain a progress/timeline variant.
- **`apps/web/src/components/wizard/StepIndicator.tsx`** — Top-of-page step bubbles (Paso 2 de 4). Currently disconnected from analysis status — only shows wizard step position.
- **`apps/web/src/lib/wizard/WizardContext.tsx`** — Wizard state management. No awareness of analysis sub-phases.
- **`apps/web/src/app/globals.css`** — Design tokens and Tailwind theme. No custom keyframe animations defined; only utility-based animations (`animate-spin`, `animate-pulse`, `animate-pulse`).

### Backend (optional enrichment)
- **`apps/api/src/analysis/analysis.service.ts`** (273 lines) — Status endpoint returns `{ documentId, status, progress }`. Could be extended with sub-phase info.
- **`apps/api/src/analysis/analysis.controller.ts`** — Lightweight controller wrapping the service.
- **`apps/api/src/ai/document-analysis.service.ts`** — Text extraction + AI call orchestration. Could expose sub-phase events.
- **`packages/contracts/src/schemas.ts`** — `AnalysisResultSchema` and type definitions. Would need new fields if sub-phase reporting is added.

### Stitch (design)
- **Project ID**: `13244395666194572658`
- **Only ONE screen exists**: "Google Flow Reference — Template Revision" (800x446 desktop) — references the overall admin flow structure.
- **No loading/waiting/analysis-state screens** exist in Stitch.

## Current UX Gaps During the 20-30s Wait

### Gap 1: The progress bar lies to the user (HIGH SEVERITY)
The progress bar jumps from 0→25→50→75→100 based on Phase 1 polling calls. After hitting 100%, the AI phase begins — but the bar stays at 100% for another 10-30 seconds with no visible activity. This creates a "stuck at 100%" experience that is worse than no progress bar at all.

### Gap 2: The stepper is frozen and misleading (HIGH SEVERITY)
The in-page stepper shows:
- Step 1 ("Validando archivo"): ✅ Completado (correct — upload succeeded)
- Step 2 ("Extrayendo texto"): 🔄 En proceso... (misleading — text extraction takes <1s)
- Step 3 ("Detectando estructura"): ⏳ Pendiente (wrong — AI is doing this NOW)
- Step 4 ("Identificando datos del caso"): ⏳ Pendiente (wrong — AI is doing this NOW)

The stepper never progresses past step 2 during the entire wait. Steps 3 and 4 only flip to "Completado" when the entire analysis finishes. The user sees a frozen interface for 20-30 seconds with no indication that anything is happening beyond "extracting text."

### Gap 3: No explanation of the long wait (MEDIUM SEVERITY)
The header says "Analizando tu contrato" and the subtext says "Estamos procesando el documento para identificar cláusulas, entidades y riesgos potenciales." This is static and never changes. There's no acknowledgment that the AI phase takes time, no "why this takes a moment" context, no indicator of what the AI is actually doing.

### Gap 4: Skeleton loaders provide zero information value (MEDIUM SEVERITY)
Both the "Vista previa del documento" and "Extracción de datos" panels show only `animate-pulse` skeleton bars. These look polished but communicate nothing about progress, what's happening, or how long remains. They're functionally identical at second 1 and second 30.

### Gap 5: No elapsed time or estimated remaining time (LOW SEVERITY)
For a 20-30 second process, showing elapsed time helps users calibrate their wait. Currently absent.

### Gap 6: File info is buried during processing (LOW SEVERITY)
The uploaded file's name and size are shown in a small card inside the document preview skeleton area. During the wait, this is easy to miss. The user might not even remember which file they're analyzing.

### Gap 7: Cancel button navigates without confirmation (LOW SEVERITY)
"Cancelar Análisis" immediately navigates back to upload without warning about losing progress or the in-flight AI call.

## What the API Provides (Available Data)

### Current status endpoint response
```json
{
  "documentId": "uuid",
  "status": "processing" | "analyzing" | "completed" | "failed",
  "progress": 0-100
}
```

### Key status differentiation available but unused
- `"processing"` → Phase 1: progress is being incremented (fast, < 2s total)
- `"analyzing"` → Phase 2: AI is extracting entities (slow, 10-30s)
- The frontend currently treats both as `isProcessing` — this is the primary lever for improvement

### What's NOT available (would require backend changes)
- Sub-phase granularity (text extraction vs AI call vs parsing)
- Estimated time remaining
- Document complexity metrics (pages, tokens, word count)
- Partial entity results (entities stream mid-analysis)
- AI model information (which model, token usage)

## Reusable Patterns in the Codebase

### Animation patterns
- `animate-spin` (Tailwind) — used in Loader2 for step 2 spinner
- `animate-pulse` (Tailwind) — used for skeleton loaders
- `transition-all duration-500` — used for progress bar width changes
- `transition-colors` — used throughout for hover states
- `transition-transform group-hover:translate-x-1` — used for arrow icons
- No custom `@keyframes` defined — all Tailwind utility-based

### Component patterns
- No reusable loading/waiting/progress component exists — all inline in `page.tsx`
- `StepIndicator` component exists but is decoupled from analysis sub-phases
- Card pattern: `rounded-xl border border-border bg-surface shadow-sm` with header bar `border-b border-border bg-background p-4`
- Status badges: green for success, blue for in-progress, gray for pending
- Progress bar: `h-2 rounded-full bg-border` with inner `bg-accent transition-all duration-500`

### Design tokens (from globals.css)
- Background: `#f5f1e8` → `bg-background`
- Surface: `#fdfcf9` → `bg-surface`
- Border: `#e0dbd3` → `bg-border`
- Accent: `#3d6b8f` → `bg-accent`
- Success: `#2d7a4f` → `text-success`
- Warning: `#b07d2a` → `text-warning`
- Danger: `#c0392b` → `text-danger`
- Typography: Literata (headlines), Source Serif 4 (body), Inter (labels)

## Stitch Screens

| Screen | Size | Purpose |
|--------|------|---------|
| "Google Flow Reference — Template Revision" | 800×446 | Overall admin flow reference |

**No loading/waiting/analysis progression screens exist.** Any new waiting UI design would need new Stitch screens created.

## Approaches

### 1. Frontend-only: Differentiate "analyzing" status + enriched copy (Recommended — Low Effort)

**Description**: Leverage the existing `status: "analyzing"` distinction from the API to show different UI during the AI phase. Update stepper phases, copy, and animations without backend changes.

- **Changes**:
  - Add `isAnalyzing` state derived from `status === "analyzing"`
  - When `analyzing`: update stepper to show steps 2-4 as "in progress" with appropriate messaging
  - Add contextual status messages that rotate: "Leyendo cada línea del documento...", "Identificando personas y entidades...", "Detectando fechas y plazos...", "Organizando la información..."
  - Change progress bar behavior: when `analyzing`, use an indeterminate animation (stripe/glow) instead of a stuck 100%
  - Add elapsed time counter
  - Show filename prominently in a badge during analysis

- **Pros**:
  - No backend changes required — pure frontend work
  - Immediate value: the UI actually reflects what's happening
  - Low risk of breaking anything
  - Estimated 2-4 hours of work

- **Cons**:
  - Progress bar will still be imprecise (no real AI progress)
  - Status messages are cosmetic, not data-driven
  - Doesn't fix the progress bar "jump to 100 then wait" problem — just masks it with indeterminate state

- **Effort**: Low

### 2. Backend sub-phase reporting + frontend consumption (Moderate Effort)

**Description**: Add sub-phase events to the backend (`text_extracting`, `ai_calling`, `ai_parsing`) and expose them via the status endpoint. The frontend consumes these for precise progress indication.

- **Changes** (backend):
  - Add `subPhase` field to `AnalysisResultSchema` and status endpoint
  - Emit sub-phase transitions in `document-analysis.service.ts`
  - Optionally: add `elapsedMs`, `estimatedRemainingMs` estimates
- **Changes** (frontend):
  - Read `subPhase` from status endpoint
  - Show precise phase indicators: "Extrayendo texto del PDF...", "Consultando al motor de IA...", "Procesando resultados..."
  - More accurate progress bar (3 sub-phases each worth ~33% of the `analyzing` phase)

- **Pros**:
  - Accurate, data-driven progress
  - Users get real information about what's happening
  - Foundation for future analysis types or longer-running operations

- **Cons**:
  - Requires backend changes + schema update + contract sync
  - More testing surface (both backend and frontend)
  - Estimated 4-8 hours for full implementation
  - Still imprecise within sub-phases (AI call latency varies)

- **Effort**: Medium

### 3. Streaming/SSE analysis progress (High Effort)

**Description**: Replace polling with Server-Sent Events for real-time progress updates during the AI phase. The backend streams progress events as it works.

- **Pros**: Real-time feedback, no polling overhead, most engaging UX
- **Cons**: Major architectural change, complex error handling, NestJS SSE plumbing, estimated 1-2 days
- **Effort**: High

### 4. New Stitch screens for the waiting experience (Design Effort)

**Description**: Create Stitch screens for the analysis waiting states to align design before implementation.

- **Pros**: Design-driven development, consistent with project design system, screens serve as acceptance criteria
- **Cons**: Requires Stitch generation/edit cycles, adds lead time before implementation starts
- **Effort**: Low-Medium (design only, no code)

## Recommendation

**Start with Approach 1 (frontend-only)**. It delivers 80% of the UX improvement with 20% of the effort. The key insight is that the API already differentiates `"processing"` from `"analyzing"` — we just need to surface that distinction in the UI.

**Then evaluate Approach 2** if the waiting time grows beyond 30s or if users need more granularity. The sub-phase reporting is a natural evolution once we prove the value of differentiated UI.

**Approach 4 (Stitch screens)** should happen before implementation to establish the visual design direction. Having screens for "analyzing state" would make implementation decisions clearer.

**Skip Approach 3** — SSE is overkill for a 20-30s wait with only 4 sub-phases.

### Concrete improvements for Approach 1:

| # | Change | Impact |
|---|--------|--------|
| 1 | Show `status: "analyzing"` as distinct state | High — different visual treatment for AI phase |
| 2 | Update stepper: steps 2-4 all show "En proceso..." during AI phase | High — no more frozen stepper |
| 3 | Rotating status messages during AI phase | Medium — humanizes the wait |
| 4 | Indeterminate progress bar during `analyzing` | High — fixes "stuck at 100%" |
| 5 | Elapsed time counter | Medium — calibrates user patience |
| 6 | Prominent file info badge during processing | Low — reminds user what they uploaded |
| 7 | Add `aria-live` region for screen reader progress | Medium — accessibility |
| 8 | Convert skeleton panels to informative cards during AI phase | Medium — replace empty skeletons with contextual info |

## Risks

- **The progress bar "stuck at 100%" could become "stuck at indeterminate"** — if the AI call fails silently, an indeterminate animation could spin forever. Mitigation: keep the timeout warning (55s) and error fallback (60 attempts).
- **Status messages rotating too fast** could feel glitchy. Recommend 5-6s per message with fade transitions.
- **No backend changes means no sub-phase precision** — the rotating messages are "best effort" decoration, not data-driven. Users with very fast or very slow AI calls may see messages that don't match reality.
- **The stepper update may conflict with existing StepIndicator** behavior — the top-level StepIndicator maps to wizard steps (Upload→Analysis→Review→Save), not analysis sub-phases. The in-page stepper is separate and can be updated independently.

## Ready for Proposal

**Yes.** The exploration provides enough detail to write a proposal. The recommended approach (frontend-only differentiation of `"analyzing"` status) is well-scoped, low-risk, and has clear actionable improvements. A proposal should:

1. Define which of the 8 concrete improvements to include in the first iteration
2. Decide whether to create Stitch screens before or in parallel with implementation
3. Establish success criteria (e.g., "user can understand what's happening during the 20-30s wait without leaving the page")
