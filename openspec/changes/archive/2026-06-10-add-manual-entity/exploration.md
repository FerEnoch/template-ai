# Exploration: add-manual-entity

## Executive Summary

Feasible. The codebase has all the foundational patterns (entity modal, AI extraction pipeline, wizard state management, entities repository) needed to add manual entity creation. The main work involves: (1) adding text selection in the document preview, (2) a new backend endpoint for single-span AI classification, (3) extending the wizard context/reducer with `ADD_ENTITY`, and (4) UI for the "+ AGREGAR CAMPO" button. Estimated 550–650 changed lines — fits within the 800-line review budget.

---

## Current State

### Review Page Flow
- `review/page.tsx` renders a split layout: left panel shows document text with highlighted entities via `renderHighlightedText()`, right panel shows `EntityInspector`.
- `renderHighlightedText()` outputs `<mark>` elements with `cursor-help` class and `title` tooltip — no click or selection handlers exist today.
- `EntityInspector` groups entities by group (PARTES/INMUEBLE/FECHAS/ANEXOS). The ANEXOS group has a hardcoded empty state: "No se han detectado anexos" with no button.
- Entity rows are clickable → opens `EntityEditModal` (dialog element) for editing value, confidence, exclusion.
- Entity updates flow: local optimistic → `UPDATE_ENTITY` reducer action → POST to `/api/review/:docId/entities/:entityId`.

### State Management
- `WizardContext.tsx` exposes `updateEntity()` only. No `addEntity()` exists.
- `wizardReducer.ts` has `UPDATE_ENTITY` (find-by-id replace). No `ADD_ENTITY` case.
- `types.ts`: `WizardAction` union has no `ADD_ENTITY` action.
- `WizardState.entities` is `Entity[]` — no schema change needed for new entities.

### Backend API
- `ReviewController`: only `POST /:documentId/entities/:entityId` for updates.
- `ReviewService.updateEntity()`: finds by ID, merges partial update fields.
- `EntitiesRepository`: has `create(input)` method taking `CreateEntityInput` — ready to use.
- `OpenRouterService.extractEntities()`: takes full document text, returns entity array via AI. System prompt is designed for full-document extraction, not single-span classification.
- No endpoint exists for single-span entity classification.

### Entity Schema (contracts)
- `EntitySchema`: `id` (uuid), `label`, `value`, `group` (PARTES|INMUEBLE|FECHAS|ANEXOS), `confidence` (ALTA|MEDIA|BAJA), `sourceSpan?`, `reviewed` (default false), `excluded` (default false).
- **No schema changes needed** — new manually-created entities use the identical shape.

### Stitch Designs
- `p2-human-review-v2.html` line 293–295: "+ AGREGAR CAMPO" button inside ANEXOS empty state.
- `p2-human-review-v1.html` line 296–308: Same pattern with "Sin campos todavía" subtext.

### Test Coverage
- 85 tests passing across web app (Vitest). EntityInspector has **no tests**. EntityEditModal has 9 tests. wizardReducer has 22 tests (no ADD_ENTITY). No review page tests.

---

## Affected Areas

| File | Impact | Lines (est.) |
|------|--------|-------------|
| `apps/web/src/components/wizard/EntityInspector.tsx` | Add "+ AGREGAR CAMPO" button, text selection mode state, `onEntityAdd` prop | +80 |
| `apps/web/src/app/review/page.tsx` | Add `addEntity` handler, selection state, wire to inspector | +50 |
| `apps/web/src/lib/wizard/types.ts` | Add `ADD_ENTITY` action type | +5 |
| `apps/web/src/lib/wizard/wizardReducer.ts` | Add `ADD_ENTITY` reducer case | +15 |
| `apps/web/src/lib/wizard/WizardContext.tsx` | Add `addEntity()` method to context | +15 |
| `apps/web/src/lib/wizard/highlightText.tsx` | Add selection event handlers on `<mark>` elements | +25 |
| `apps/api/src/review/review.controller.ts` | Add `POST /:documentId/entities` endpoint | +15 |
| `apps/api/src/review/review.service.ts` | Add `createEntity()` method | +50 |
| `apps/api/src/ai/` (new or existing) | Single-span AI classification method | +60 |
| `apps/web/src/mocks/handlers.ts` | Add `POST /api/review/:docId/entities` handler | +30 |
| **Tests** | new tests for ADD_ENTITY, EntityInspector, create endpoint | +180 |
| **Total estimated changed lines** | | **~550–650** |

---

## Approaches

### Approach A: AI-First (Single-span classification)

User selects text in document preview → frontend captures selected text span + surrounding context → sends to new backend endpoint → backend calls OpenRouter with a single-entity classification prompt → returns label, group, value → frontend creates entity with confidence=ALTA, `sourceSpan` from selection.

1. **Pros**: Accurate label/group inference, consistent with existing AI pipeline, minimal user effort
2. **Cons**: AI latency (~2–5s), new backend endpoint + prompt engineering needed, adds OpenRouter cost per manual entity
3. **Effort**: Medium

### Approach B: Client-side Modal (Manual only)

"+ AGREGAR CAMPO" opens EntityEditModal in "create" mode (or new EntityCreateModal) → user manually fills label, value, group, confidence → entity added to state → POST to backend to persist.

1. **Pros**: Instant (no AI latency), reuses existing modal pattern maximally, simplest implementation (~350 lines)
2. **Cons**: User bears cognitive load of choosing label and group taxonomy, no "Con traza" badge (unless text selection feeds sourceSpan manually)
3. **Effort**: Low

### Approach C: Hybrid (AI with manual fallback)

"+ AGREGAR CAMPO" opens modal with pre-filled selected text → "Sugerir etiqueta" button triggers backend AI classification → fills label/group → user confirms or overrides → entity created.

1. **Pros**: Best UX, user has agency, AI reduces cognitive load
2. **Cons**: Most UI complexity, still needs backend endpoint, more test surface
3. **Effort**: Medium-High

---

## Recommendation

**Approach A (AI-First)** with a lightweight inline loading state. The user explicitly requested AI label/group inference. The existing `OpenRouterService.extractEntities()` infrastructure can be reused with a targeted single-entity prompt. Since `confidence` is always `ALTA` for user-initiated entities (not needing AI confidence judgment), the AI only needs to infer `label` and `group`, which simplifies both the prompt and the response format.

Key design decisions:
- **Text selection**: Add `onMouseUp` handler to the document preview container, use `window.getSelection()` to get the selected text and compute character offsets against the full `extractedText`. Surrounding context (±100 chars) sent alongside the selected span.
- **Modal UX**: After selection, show a compact confirmation modal with the selected text, a loading spinner while AI classifies, then the inferred label/group. User confirms or edits before creation.
- **API endpoint**: `POST /api/review/:documentId/entities` with body `{ value, sourceSpan, context, analysisResultId }` — returns `{ label, group }`.
- **Confidence**: Always `ALTA` — user-initiated entities are trusted.
- **"Con traza" badge**: Already auto-rendered by EntityInspector when `entity.sourceSpan` exists (line 273-277).

---

## Risks

- **AI classification latency**: Single-entity classification via OpenRouter may take 2–5s. Mitigation: show a spinner during classification with a cancel option.
- **Text selection precision**: `window.getSelection()` with `extractedText` character offsets can be tricky with multi-byte characters or whitespace. Mitigation: use `selection.getRangeAt(0)` and calculate offset against the text content node.
- **AI cache miss**: The current `OpenRouterService` caches responses by full document SHA-256. Single-span classification will always be cache-misses. Mitigation: per-span classification is small (low token cost) — acceptable.
- **Review budget**: Estimated 550–650 lines fits within 800, but chaining may still be recommended for clean separation: PR1 (backend + contracts) / PR2 (frontend + UI + tests).
- **EntityInspector has no tests**: Adding tests for the new selection/creation flow should include basic EntityInspector tests to establish coverage foundation.
- **Error handling**: If AI classification fails, the user should be able to manually fill label/group (graceful degradation to Approach B).

---

## Open Questions

1. **Should the "+ AGREGAR CAMPO" button appear only in the ANEXOS empty state, or in all group headers?** The Stitch design shows it only in ANEXOS, but the user may want to manually add entities to any group.
2. **What "surrounding context" size?** ±100 characters is a reasonable default. Should this be configurable?
3. **Should manual entities be editable after creation?** Current EntityEditModal pattern should work if we add newly-created entities to the same state array — the entity is just a normal Entity after creation.
4. **Should the AI classification endpoint be a separate controller or extend the existing ReviewController?** Recommend extending ReviewController since it's a review-phase operation.
5. **Confirmation flow**: Should the user confirm the AI-inferred label/group before the entity is saved, or should it auto-save with an undo option?

---

## Ready for Proposal

**Yes** — the codebase is well-understood, all affected areas are identified, and there are no architectural blockers. The orchestrator should proceed to `sdd-propose` with the following sign-off items:
- Confirm whether "+ AGREGAR CAMPO" should appear in all group headers or only ANEXOS.
- Confirm the AI classification prompt design (reuse existing prompt with modifications, or new targeted prompt).
- Confirm whether manual entities should be editable post-creation (recommended: yes, same as AI-detected entities).
