# Proposal: Add Manual Entity Creation

## Intent

AI extraction misses fields; users have no way to add them. Add a text-selection flow: classify a span via AI, let the user confirm, persist a new entity. Capped at 5 manual fields per subscription tier.

## Scope

**In:** `POST /api/review/:resultId/entities/classify-span` + `POST /api/review/:resultId/entities` · `OpenRouterService.classifySpan()` strict-JSON prompt · `ADD_ENTITY` in reducer/context · `+ AGREGAR CAMPO` in all 4 group headers + empty states · `EntityCreateModal` (mode="create", ALTA locked) · `window.getSelection()` capture · 5-field cap (client disables, server 403 `MANUAL_ENTITY_LIMIT_REACHED`) · Zod schemas in `@template-ai/contracts` · Tests: service, controller, reducer, context, modal, inspector, E2E.

**Out:** new subscription tiers, billing, paywall; bulk/multi-span; Stitch screen (deferred); AI confidence inference (manual = ALTA); schema migrations.

## Capabilities

### New

- `manual-entity-creation`: text-selection-driven create flow with AI classification, user confirmation, 5-field cap.

### Modified

- `entity-editing`: modal gains `mode="create"`; label editable in create mode
- `client-wizard-flow`: `ADD_ENTITY` action + `addEntity()` context method
- `subscription-access`: enforces 5 manual fields per subscription
- `shared-contracts`: new `ClassifySpanRequest` / `ClassifySpanResponse` Zod schemas

## Approach

Reuse the AI pipeline with a narrower single-span prompt. Frontend captures `window.getSelection()` against `extractedText`, sends `{ text, sourceSpan: { start, end }, context: ±100 chars }`, receives `{ label, group, value }`, opens create modal pre-filled; on confirm dispatches `ADD_ENTITY` then POSTs. 5-cap enforced server-side as source of truth.

## Affected Areas

- **Backend:** `review.controller.ts` (new endpoints) · `review.service.ts` (`classifySpan`, `createEntity`, cap check) · `open-router.service.ts` (`classifySpan()`)
- **Contracts:** `packages/contracts/src/schemas.ts` — new Zod schemas, `MANUAL_ENTITY_LIMIT=5`
- **Wizard:** `wizardReducer.ts` (`ADD_ENTITY`) · `WizardContext.tsx` (`addEntity()`) · `types.ts` (`ADD_ENTITY`)
- **UI:** `highlightText.tsx` (`onSelectionComplete`) · `EntityInspector.tsx` (`+ AGREGAR CAMPO`, disabled) · `EntityEditModal.tsx` (`mode="create"`, editable label) · `EntityCreateModal.tsx` (new) · `app/review/page.tsx` (selection state, classify handler)
- **Mocks:** `apps/web/src/mocks/handlers.ts` (MSW handlers)

## Risks

AI latency 2–5s → spinner + cancel · Malformed JSON → Zod server-side, 422 + retry · Cap drift → server is truth · EntityInspector zero coverage → tests in PR2 · Multi-byte offsets → `String.slice`, UTF-8 E2E · Selection inside `<mark>` → detect overlap, warn · 800-line budget → exploration says 550–650.

## Rollback Plan

Feature flag `manualEntityCreation.enabled=false` → endpoint 404 · PR1 and PR2 independently revertable (additive) · no schema migration; data stays in `Entity`.

## Dependencies

`OpenRouterService` in place · `@template-ai/contracts` Zod infra · MSW handler file exists · subscription state persists; need `manualEntityLimit` getter.

## Success Criteria

`+ AGREGAR CAMPO` in all 4 group headers · classify-span within 5s · create modal pre-filled, ALTA locked · new entity shows `Con traza` badge and persists · button disabled after 5 manual · server 403 on bypass · all 85 existing tests pass + new tests · PR1 ≤ 400 lines, PR2 ≤ 400 lines.
