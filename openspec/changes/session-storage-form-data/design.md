# Design: session-storage-form-data

## Technical Approach

Add a `sessionStorage` write-through cache for the new-case form's `formData`, mirroring the wizard's `localStorage` draft (`apps/web/src/lib/wizard/storage.ts`) but keyed `case-form-draft:v1`, scoped per-tab. Three storage functions sit in a Ports-style "adapter" module; `CaseProvider` hydrates on `setCase`, debounces (300ms) writes on `formData` change, and exposes `clearDraft()` consumed by the page on terminal transitions. Server remains source of truth — the 30s `PATCH` auto-save is untouched; the draft is only a client-side resilience layer.

## Architecture Decisions

### Decision: Hydrate via effect on `state.caseId`, not inside `setCase` callback

| Option | Tradeoff |
|---|---|
| Hydrate in `setCase` useCallback | Has `caseItem` but closures stale `template` — stale-key filter needs current entities |
| **`useEffect` on `[state.caseId]` + `lastHydratedCaseId` ref** | Reads live `state.template.entities` for R4 stale-key filter; guards re-hydration on `UPDATE_FIELD` |

**Rationale**: `setCase` is fired after `setTemplate` in bootstrap (page.tsx L31-35), so `state.template` is populated when the caseId effect runs. Effect-based init follows `rerender-lazy-state-init`/`advanced-init-once` (waterfalls avoided; no SSR access). The ref prevents re-dispatch when `formData` mutates later.

### Decision: Clear on both `handleGenerate` AND `handleSave` (R5)

| Option | Tradeoff |
|---|---|
| Clear only on `generado` (proposal Q2 default) | Wider data-loss window if tab closes after a blip |
| **Clear on `generado` + successful `handleSave` (spec R5)** | Tighter; matches spec MUST. Risk: brief server outage during save clears draft without flushed server data |

**Rationale**: spec R5 is authoritative over the proposal's open-question default. Mitigation for the risk: `handleSave` only calls `clearDraft()` **after** `saveForm()` resolves (page.tsx wraps `await saveForm()` inside try). Spec scenario "No clear if save fails" enforces this.

### Decision: Single write effect, `setTimeout` debounce, no write before hydrate completes

| Option | Tradeoff |
|---|---|
| Write on every `UPDATE_FIELD` synchronously | Violates `js-cache-storage`; one `setItem` per keystroke |
| **300ms `setTimeout` in a `useEffect` on `[state.caseId, state.formData]`** | One `setItem` per 300ms window; cleared on unmount |

**Rationale**: matches R2 + `js-cache-storage`. The hydrate `SET_FORM_DATA` also fires this effect once — harmless (idempotent rewrite of same draft) and avoids a special "skip first" flag. Guarded by `state.caseId` truthiness so no write occurs pre-bootstrap.

## Data Flow

```
 Page bootstrap ──setTemplate──► CaseProvider state.template
        └──setCase(case)──► state.caseId + server formData
                                   │
   [state.caseId] effect ──loadCaseFormDraft()──► (R4 intersect entities)
                                   │
                          SET_FORM_DATA draft ──► state.formData
                                   │
   user types────────UPDATE_FIELD────► state.formData
                                   │
   [formData] effect ─debounce 300ms──► saveCaseFormDraft()
                                   │
   handleGenerate success ──┐
   handleSave success ───────┴──► clearCaseFormDraft() (R5)
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `packages/contracts/src/schemas.ts` | Modify | Add `CaseFormDraftSchema` + infer `CaseFormDraft` |
| `packages/contracts/src/index.ts` | Modify | Re-export schema + type |
| `apps/web/src/lib/case/caseFormStorage.ts` | Create | `load/save/clearCaseFormDraft`, `typeof window` + try/catch, key `case-form-draft:v1` |
| `apps/web/src/lib/case/index.ts` | Create | Re-export storage fns (mirror `wizard/index.ts`) |
| `apps/web/src/lib/case/CaseContext.tsx` | Modify | Hydrate effect, debounce-write effect, `clearDraft` in context value |
| `apps/web/src/app/nuevo/[templateId]/page.tsx` | Modify | Call `clearDraft()` after `handleGenerate` success + `handleSave` success |
| `apps/web/src/lib/case/__tests__/caseFormStorage.test.ts` | Create | Mirror `storage.test.ts`: round-trip, invalid JSON, schema-violation, missing window |
| `apps/web/src/lib/case/__tests__/CaseContext.test.tsx` | Modify | Add provider-level RTL tests: hydrate, debounce write, clear, stale-key drop |

## Interfaces / Contracts

```ts
// packages/contracts/src/schemas.ts
export const CaseFormDraftSchema = z.object({
  caseId: z.string().uuid(),
  templateId: z.string().uuid(),
  formData: z.record(z.string(), z.string()),
  savedAt: z.string().datetime(),
});
export type CaseFormDraft = z.infer<typeof CaseFormDraftSchema>;

// apps/web/src/lib/case/caseFormStorage.ts
export function loadCaseFormDraft(): CaseFormDraft | null;
export function saveCaseFormDraft(input: { caseId: string; templateId: string; formData: Record<string,string> }): void;
export function clearCaseFormDraft(): void;
```

`CaseContextValue` gains `clearDraft: () => void`. `CaseAction` unchanged — hydrate reuses existing `SET_FORM_DATA`.

```tsx
// CaseContext.tsx — hydrate effect sketch
const lastHydratedCaseId = useRef<string | null>(null);
useEffect(() => {
  if (!state.caseId || !state.template) return;
  if (lastHydratedCaseId.current === state.caseId) return; // R3 once per case
  lastHydratedCaseId.current = state.caseId;
  const draft = loadCaseFormDraft();
  if (!draft || draft.caseId !== state.caseId) return;      // R3 match
  const valid = new Set(state.template.entities.map(e => e.id)); // R4
  const filtered = Object.fromEntries(Object.entries(draft.formData).filter(([k]) => valid.has(k)));
  dispatch({ type: "SET_FORM_DATA", payload: filtered });
}, [state.caseId, state.template]);

// debounced write effect sketch
const writeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
useEffect(() => {
  if (!state.caseId || !state.template) return;
  if (writeTimer.current) clearTimeout(writeTimer.current);
  writeTimer.current = setTimeout(() => {
    saveCaseFormDraft({ caseId: state.caseId, templateId: state.template!.id, formData: state.formData }); // R2
  }, 300);
  return () => { if (writeTimer.current) clearTimeout(writeTimer.current); };
}, [state.caseId, state.template, state.formData]);

useEffect(() => () => { if (writeTimer.current) clearTimeout(writeTimer.current); }, []);
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `caseFormStorage` save/load/clear, invalid JSON clears, schema-violation clears, missing `window`/`sessionStorage` (separate mock from `localStorage`), quota throws degrade silently (R7) | Vitest, mock `globalThis.sessionStorage` like `storage.test.ts` mocks `localStorage` |
| Unit/Integration | Reducer unchanged (existing tests stay green) | Existing `caseReducer` tests |
| Integration | `CaseProvider` hydrates matching draft on mount; stale key dropped (R4); `UPDATE_FIELD` → one `setItem` within 300ms (R2, use `vi.useFakeTimers`); `clearDraft()` removes key (R5); hydrate skipped on re-render (ref guard) | `@testing-library/react` + jsdom + a child consumer reading `useCase()`. Provider-level tests new to this file |

Provider tests need a child component subscribing to `useCase()` and a `renderHook`-style assertion. Use `vi.useFakeTimers()` + `vi.advanceTimersByTime(300)` for debounce. Mock `sessionStorage` per-test via `Object.defineProperty(globalThis, "sessionStorage", {...})`.

## Migration / Rollout

No migration. Rollback: revert PR — no durable data (sessionStorage is tab-local, GC'd on tab close). Bug fix path: bump to `case-form-draft:v2`; old `v1` keys fail Zod parse → `loadCaseFormDraft` clears them (no redeploy of write path).

## Open Questions

- [ ] None blocking. Note: spec R5 (clear on both generate + save) overrides proposal Q2 default — intentional, spec is authoritative.