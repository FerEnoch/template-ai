# Proposal: ai-inference-upgrade

## Executive Summary

Upgrade the three AI-powered features (entity extraction, span classification, document generation) from hardcoded, real-estate-only, single-model prompts to a production-grade inference layer: a prompt template engine, a per-task model router (production only), dynamic few-shot from user-reviewed entities, and model-suggested dynamic groups. All tiers (quick wins, medium, architectural) ship together in this change.

## Intent

The current AI layer produces wrong or brittle results: groups are hardcoded to 4 real-estate categories (PARTES/INMUEBLE/FECHAS/ANEXOS), span classification has zero few-shot examples and no fallback, document generation has no tone/formatting/conflict rules, and a single model serves all tasks. Users see hallucinated entities, misgrouped values (PRECIO_TOTAL under INMUEBLE), and unclassifiable spans with no escape hatch. There is no feedback loop, no shared safety preamble, and prompts are inseparable from code.

## Scope

### In Scope
- **Quick wins**: `GENERAL`/`OTROS` catch-all group; 2-3 additional few-shot examples (laboral, mercantil); explicit "don't invent" rule; confidence criteria (ALTA/MEDIA/BAJA) definitions; unified system safety preamble (honesty, no-inference, privacy).
- **Medium**: prompt template engine (prompts → loadable files, separated from code); dynamic groups (model suggests, user approves); post-generation verification prompt; chain-of-thought for extraction.
- **Architectural**: model router (production only, per-task env vars + universal fallback); dynamic few-shot from user's reviewed entities; feedback loop (corrections feed future prompts).

### Out of Scope
- Real model fine-tuning / weight changes (by decision: "fine-tuning" = dynamic few-shot only).
- Embeddings/vector store / semantic example selection (MVP: deterministic reviewed-entity injection).
- OCR for scanned PDFs.
- New AI features (summarization, translation, Q&A).
- Frontend rewrite of review step (only minimal: dynamic group headers + group-approval UI).

## Capabilities

> Contract with sdd-spec. Researched `openspec/specs/`.

### New Capabilities
- `ai-prompt-engine`: prompt template engine — loadable prompt files, unified safety preamble, CoT extraction, post-generation verification, `[COMPLETAR]` guidelines, Mexican legal tone/style, formatting preservation, conflict-resolution rules, confidence criteria, "don't invent" rules, expanded few-shot (laboral/mercantil).
- `ai-model-router`: production-only per-task model routing (extraction / classification / generation) with universal fallback, gated by `AI_MODEL_ROUTER_ENABLED`, per-task env vars, bootstrap validation. Dev/test stay single-model via `AI_MODEL`.
- `ai-dynamic-few-shot`: runtime injection of a user's previously-reviewed entities as few-shot examples; feedback loop where user corrections feed future extraction prompts. No model weights change.
- `ai-dynamic-groups`: model may suggest new group categories beyond the seed set; user approves suggested groups; `GENERAL`/`OTROS` catch-all for non-categorized entities.

### Modified Capabilities
- `ai-error-resilience`: integrate per-task model fallback into the existing retry/classification contract; add router config validation at bootstrap (extends existing token-budget validation).
- `shared-contracts`: extend entity `group` beyond `PARTES|INMUEBLE|FECHAS|ANEXOS` — add `GENERAL`/`OTROS`, accept model-suggested dynamic groups. Aligns code enum (`packages/contracts/src/schemas.ts:23,52`) with the already-flexible spec (`group: non-empty string`).
- `manual-entity-creation`: `classify-span` MAY return `GENERAL`/`OTROS` or a dynamic group; add a fallback path for unclassifiable spans; "+ AGREGAR CAMPO" renders in dynamic group headers, not only the 4 seed groups.

## Approach

1. **Prompt engine first** (`apps/api/src/ai/prompts/`): extract the three hardcoded prompt constants into versioned, loadable template files with a small interpolation layer (`{{documentText}}`, `{{fewShot}}`, `{{groups}}`). Introduce a shared `SAFETY_PREAMBLE` prepended to every task.
2. **Model router** (`apps/api/src/ai/model-router.ts` + `apps/api/src/config/ai.ts`): resolve model per task at call time. When `AI_MODEL_ROUTER_ENABLED=true`, read `AI_MODEL_EXTRACTION` / `AI_MODEL_CLASSIFICATION` / `AI_MODEL_GENERATION`, falling back to `AI_MODEL_FALLBACK` then `AI_MODEL`. Reuse the existing `callModelWithFallback` pattern, generalized per task.
3. **Dynamic few-shot**: a new `FewShotProvider` retrieves the user's reviewed entities (from the existing entities/templates tables) and injects 2-3 as examples. Corrections (entity edits) are persisted and surface on the next extraction — closing the loop.
4. **Dynamic groups**: extraction schema accepts a `groups` array (seed + user-approved) passed into the prompt; model may emit a `suggestedGroup` that enters an approval flow.
5. **Verification**: a second, cheap post-generation prompt checks the generated doc for unresolved `[COMPLETAR]` markers and structural integrity.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `apps/api/src/ai/open-router.service.ts` | Modified | Remove hardcoded prompts/enums; route model per task; accept dynamic groups; inject few-shot. |
| `apps/api/src/ai/document-generation.service.ts` | Modified | Consume prompt engine; add verification step; conflict-resolution rules. |
| `apps/api/src/ai/document-analysis.service.ts` | Modified | Pass reviewed entities for few-shot; route through new prompt engine. |
| `apps/api/src/ai/prompts/` (new) | New | Loadable prompt templates + `SAFETY_PREAMBLE` + few-shot blocks. |
| `apps/api/src/ai/model-router.ts` (new) | New | Per-task model resolution + fallback. |
| `apps/api/src/ai/few-shot-provider.ts` (new) | New | Retrieve reviewed entities; feedback loop. |
| `apps/api/src/config/ai.ts` | Modified | Add router env vars + bootstrap validation. |
| `packages/contracts/src/schemas.ts` | Modified | Expand `group` enum to include `GENERAL`/`OTROS`; align with dynamic groups. |
| `apps/web` review step | Modified | Render dynamic group headers + group-approval UI. |
| `openspec/specs/ai-error-resilience`, `shared-contracts`, `manual-entity-creation` | Modified | Delta specs (see Capabilities). |

## Architecture Decisions & Tradeoffs

| Decision | Tradeoff |
|----------|----------|
| **Model router production-only**; dev/test single model via `AI_MODEL`. | Keeps test suite deterministic and cheap; production gains per-task optimization. Risk: dev/prod drift — mitigated by a router contract test that asserts resolution logic. |
| **"Fine-tuning" = dynamic few-shot**, not weight changes. | No training cost, instant iteration; bounded by context window. Risk: example pollution — mitigated by capping at 3 reviewed examples and deterministic selection. |
| **Dynamic groups with user approval** vs. free-form model groups. | Adapts to non-real-estate domains (laboral, mercantil) without prompt rewrite; user stays in control. Risk: group sprawl — mitigated by approval gate + `GENERAL`/`OTROS` fallback. |
| **Prompts as loadable files** vs. in-code constants. | Non-engineers can tune prompts without deploys; versionable. Tradeoff: added indirection and a loader to test. |
| **Verification prompt** as a second call. | Catches `[COMPLETAR]` leakage and structure loss; cost: one extra cheap call per generation. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Group-enum expansion breaks existing frontend group filters/renderers. | Med | Ship `GENERAL`/`OTROS` as additive; frontend treats unknown groups as a generic rendered section. Contract tests cover both. |
| Dynamic few-shot inflates context → JSON truncation on long docs. | Med | Cap few-shot block; respect `AI_MAX_TOKENS` budget; reuse existing `INVALID_RESPONSE` retry path. |
| Router config misconfiguration silently falls back to wrong model in prod. | Med | Bootstrap validation fails fast on missing per-task vars when router enabled; logged resolution trace per call. |
| `new-case-flow` change (in-flight) introduces `document-generation` spec — conflict with this change's generation prompt delta. | Med | Coordinate sequencing: archive `new-case-flow` first, OR target generation prompt changes via `ai-prompt-engine` (new capability) to avoid touching the in-flight delta. |
| `sourceSpan` correction breaks with new groups (post-validation unchanged). | Low | Existing `validateAndCorrectSpans` is group-agnostic; no change needed. |
| Increased latency from verification + CoT calls. | Med | Verification uses a fast/cheap model via the router; CoT only for extraction. |

## Rollback Plan

1. Revert the merged PR slices (chained PRs target previous slice branch).
2. Disable `AI_MODEL_ROUTER_ENABLED` → all calls fall back to single `AI_MODEL`, restoring prior behavior.
3. Remove the `prompts/` loader import; the old inline prompt constants remain available behind a feature flag until full removal.
4. Contracts: the `GENERAL`/`OTROS` addition is additive — entities with new groups remain in DB. Reverting the enum change re-adds the CHECK constraint; any entity with a non-seed group would need manual reassignment or deletion.
5. DB migrations (3 additive): `0015` (drop `entities_group_allowed` CHECK → non-empty CHECK), `0016` (add `entities.reviewed_at` + backfill), `0017` (add `templates.suggested_groups_status JSONB`). Rollback: reverse each migration (`ADD CONSTRAINT`, `DROP COLUMN`). No data loss — `reviewed_at` is derived, `suggested_groups_status` defaults to `{}`.

## Dependencies

- `new-case-flow` change must be archived (so `document-generation` is a main spec) OR generation prompt changes scoped entirely under the new `ai-prompt-engine` capability.
- Existing `ai-error-resilience` retry contract (foundation for router fallback).
- Existing Redis cache (`AI_CACHE_ENABLED`) — few-shot and router resolution are cache-friendly.
- OpenRouter account/quota for per-task model env vars in production.

## Success Criteria

- [ ] Extraction works on a laboral AND a mercantil contract (not just real estate), with entities grouped correctly including `GENERAL`/`OTROS` where appropriate.
- [ ] Span classification returns a sensible result for an unclassifiable span via fallback, with at least 2 few-shot examples in the prompt.
- [ ] Generated document preserves paragraph/clause structure and contains no unresolved `[COMPLETAR]` markers after verification (on a fixture case).
- [ ] In production (`AI_MODEL_ROUTER_ENABLED=true`), logs show each task resolved to its configured model; misconfiguration fails at bootstrap.
- [ ] A user who corrects 3 entities sees those corrections injected as few-shot in their next extraction (verified by prompt-content assertion in tests).
- [ ] All existing `pnpm --filter @template-ai/api test` pass; new tests cover prompt engine, router resolution, few-shot injection, dynamic groups.

## Non-Goals

- No real fine-tuning, embeddings, or vector retrieval.
- No new AI features (summarization, translation, Q&A, OCR).
- No change to the async worker's external contract (`processing → analyzing → completed|failed`).
- No frontend review-step rewrite beyond dynamic group headers + approval UI.
- No multi-tenant prompt customization per organization.

## Open Questions

1. **Group-approval UX**: when the model suggests a new group, does approval happen inline in the review step, or in a separate "group library" settings page? (Affects scope of frontend work.)
2. **Few-shot selection**: should injected reviewed entities be the most-recent N, or filtered by document type/template? (Affects `FewShotProvider` query.)
3. **Verification strictness**: does a failed verification block delivery (hard fail) or only warn the user? (Affects generation R-something error path.)
4. **Sequencing with `new-case-flow`**: archive-first, or scope generation prompts under `ai-prompt-engine` to decouple?
5. **Router defaults**: should `AI_MODEL_FALLBACK` be required when the router is enabled, or optional with a documented degradation?
