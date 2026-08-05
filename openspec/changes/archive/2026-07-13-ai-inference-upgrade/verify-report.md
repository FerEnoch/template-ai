# Verify Report: ai-inference-upgrade

**Branch**: `feature/ai-inference-upgrade-pr8`
**Date**: 2026-07-13
**Status**: **PASS** (with warnings)

## Test Results

| Suite | Files | Tests | Status |
|---|---|---|---|
| API (`@template-ai/api`) | 41 passed, 1 skipped | 479 passed, 2 skipped | ✅ GREEN |
| Web (`@template-ai/web`) | 31 passed | 239 passed | ✅ GREEN |
| Typecheck (contracts + api + web) | 3 packages | — | ✅ GREEN |

## Spec Verification

### 1. ai-prompt-engine

| # | Requirement | Strength | Result | Evidence |
|---|---|---|---|---|
| R1 | Loadable prompt files | MUST | ✅ PASS | 6 `.md` files in `prompts/`; `PromptEngine` with `Map` cache; `nest-cli.json` assets copy `ai/prompts/**/*.md` |
| R2 | Unified safety preamble | MUST | ✅ PASS | `_shared/safety.md` with honesty/no-inference/privacy; `renderWithSafety()` prepends |
| R3 | Chain-of-thought extraction | SHALL | ✅ PASS | `extraction/system.md` line 19: "Razoná paso a paso" CoT directive |
| R4 | Post-generation verification | SHALL | ✅ PASS | `VerificationService.verify()` + `verification.md`; advisory, never blocks |
| R5 | `[COMPLETAR]` guidelines | MUST | ✅ PASS | `with-base.md` lines 22-24 and `no-base.md` lines 24-26: marker + footnote instructions |
| R6 | Mexican legal tone | SHOULD | ✅ PASS | All generation prompts specify "formal de derecho mexicano (es-MX)" |
| R7 | Confidence criteria | MUST | ✅ PASS | `extraction/system.md` lines 29-31: ALTA/MEDIA/BAJA thresholds defined |
| R8 | "Don't invent" rules | MUST | ✅ PASS | `extraction/system.md` line 23 + `safety.md` line 3 |
| R9 | Expanded few-shot blocks | SHALL | ✅ PASS | `FewShotProvider` cross-document, domain-agnostic selection |
| R10 | Conflict-resolution rules | SHOULD | ✅ PASS | `with-base.md` lines 26-27: explicit clause prevails |
| R11 | Prompt file versioning | SHALL | ✅ PASS | Files tracked in git |
| R12 | Prompt engine API | MUST | ✅ PASS | `load()`, `render()`, `renderWithSafety()`; 11 tests pass |

### 2. ai-dynamic-groups

| # | Requirement | Strength | Result | Evidence |
|---|---|---|---|---|
| R1 | Model-suggested groups | MAY | ✅ PASS | `parseSuggestedGroups()` in `open-router.service.ts`; optional in result |
| R2 | Inline user approval | MUST | ✅ PASS | `SuggestedGroupChips.tsx` with ✓/✗ buttons; 5 tests pass |
| R3 | Approved groups join seed set | MUST | ✅ PASS | `GroupsService.resolve()` appends approved; `approve()` persists |
| R4 | GENERAL/OTROS catch-all | MUST | ✅ PASS | `SEED_GROUPS` includes both; `groupEntities.ts` GROUP_ORDER; fallback to GENERAL |
| R5 | Suggested groups flow | MUST | ✅ PASS | `TemplateSchema.suggestedGroupsStatus`; persisted via `updateSuggestedGroups()` |
| R6 | Group naming constraints | SHALL | ✅ PASS | `/^[A-Z0-9/]{2,30}$/`; invalid discarded + WARNING |

### 3. shared-contracts

| Requirement | Result | Evidence |
|---|---|---|
| Entity `reviewedAt` timestamp | ✅ PASS | `z.string().datetime().nullable().optional()`; migration 0016 |
| Dynamic group acceptance | ✅ PASS | `group: z.string().min(1)` in both Entity and ClassifySpan schemas |
| Template `suggestedGroupsStatus` | ✅ PASS | `z.record(z.enum(["pending","approved","rejected"])).optional()` |
| SEED_GROUPS/GENERAL/OTROS exports | ✅ PASS | Exported from `packages/contracts/src/schemas.ts` |
| `GenerateDocumentResponse` verification | ✅ PASS | `verification: { passed, completarCount, warnings, degraded }` optional |

### 4. ai-error-resilience

| Requirement | Result | Evidence |
|---|---|---|
| Router config validation at bootstrap | ✅ PASS | `validateRouterConfig()` throws on router+!AI_MODEL; 20 tests in `ai.spec.ts` |
| Per-task model fallback | ✅ PASS | `callWithRetryChain()`: 3 primary + 1 per fallback; CONFIG_ERROR aborts |
| Expanded retry policy | ✅ PASS | Retryable: RATE_LIMIT/NETWORK_ERROR/INVALID_RESPONSE; CONFIG_ERROR not retried |

### 5. ai-model-router

| # | Requirement | Strength | Result | Evidence |
|---|---|---|---|---|
| R1 | Feature gate | MUST | ✅ PASS | `AI_MODEL_ROUTER_ENABLED === "true"` check; disabled → `AI_MODEL` |
| R2 | Per-task resolution | MUST | ✅ PASS | `TASK_ENV_VAR` maps 3 tasks; `resolveModel()` reads per-task first |
| R3 | Universal fallback chain | MUST | ✅ PASS | `resolveModelChain()`: perTask → FALLBACK → AI_MODEL, deduped |
| R4 | Bootstrap validation | MUST | ✅ PASS | Throws on router+!AI_MODEL; WARNING for missing per-task |
| R5 | Dev/test single-model | SHALL | ✅ PASS | Disabled → no router vars read |
| R6 | Resolution trace logging | SHALL | ✅ PASS | WARNING logs at each fallback step |
| R7 | Optional FALLBACK | SHOULD | ✅ PASS | Falls to AI_MODEL with WARNING when unset |

### 6. ai-dynamic-few-shot

| # | Requirement | Strength | Result | Evidence |
|---|---|---|---|---|
| R1 | Few-shot injection | MUST | ✅ PASS | `FewShotProvider.getExamples()`; empty → "" |
| R2 | Feedback loop | MUST | ✅ PASS | `findReviewedForFewShot()` cross-document query |
| R3 | Deterministic selection | SHALL | ✅ PASS | `ORDER BY reviewed_at DESC LIMIT 3`; partial index |
| R4 | Context budget cap | MUST | ✅ PASS | 25% of `AI_MAX_TOKENS`; truncate to 1 + WARNING |
| R5 | Entity type filtering | SHOULD | ✅ PASS | `reviewed=true AND excluded=false` in query + index |
| R6 | Cross-document isolation | MUST | ✅ PASS | Query joins on `user_id`, not limited to current document |

### 7. manual-entity-creation

| Requirement | Result | Evidence |
|---|---|---|
| Fallback for unclassifiable spans | ⚠️ WARNING | `buildUnclassifiedFallback()` returns `label: "SIN_CLASIFICAR"` — spec says `label: ""`. Tests pass with implementation value; spec text divergence. |
| Malformed JSON fallback | ⚠️ WARNING | Same as above — `label: "SIN_CLASIFICAR"` vs spec `label: ""` |
| Dynamic group in classify-span | ⚠️ WARNING | `review.service.ts` calls `groupsService.resolve()` WITHOUT `templateId` (line 132), so only seed groups are resolved. Dynamic groups returned by the model will be overridden to GENERAL. |
| "+ AGREGAR CAMPO" in all headers | ✅ PASS | `EntityInspector.tsx` renders button in empty state + all group headers including dynamic |
| Button disabled at limit | ✅ PASS | `isLimitReached` disables button with tooltip |
| Entity creation modal dropdown | ✅ PASS | `EntityEditModal` accepts `availableGroups`; dropdown renders all provided groups |
| Confidence locked to ALTA in create | ✅ PASS | Create mode shows disabled ALTA button |

## Warnings

### W1: classify-span fallback label divergence (LOW)

**Spec**: `manual-entity-creation` ADDED scenario says fallback entity should have `label: ""`.
**Implementation**: `review.service.ts` `buildUnclassifiedFallback()` returns `label: "SIN_CLASIFICAR"`.
**Impact**: Tests pass with `"SIN_CLASIFICAR"`. The implementation is internally consistent but diverges from the literal spec text. The descriptive label is arguably better UX.
**Action**: Amend spec text to match implementation, or change implementation to `""`.

### W2: classify-span does not resolve dynamic groups (MEDIUM)

**Spec**: `manual-entity-creation` ADDED scenario says classify-span MAY return dynamic groups like "JORNADA".
**Implementation**: `review.service.ts` line 132 calls `this.groupsService.resolve()` without a `templateId`, so only seed groups are returned. Any dynamic group from the model is treated as unknown and overridden to GENERAL.
**Impact**: Dynamic group classification via classify-span is non-functional. The model can suggest groups via `suggestedGroups` in extraction, but the manual classify-span endpoint cannot return them.
**Action**: Pass the document's `templateId` to `groupsService.resolve()` in `classifySpan()`. Requires looking up the template from the document within the method.

## Infrastructure Checks

| Check | Result |
|---|---|
| Migrations 0015-0017 exist | ✅ |
| Migration 0015: drop CHECK + add non-empty CHECK | ✅ |
| Migration 0016: `reviewed_at` + backfill + partial index | ✅ |
| Migration 0017: `suggested_groups_status JSONB` | ✅ |
| Migration integration test (0015-0017) | ✅ 6 tests pass |
| `nest-cli.json` assets copy prompts | ✅ |
| `ai.module.ts` registers new providers | ✅ |
| All prompt files exist (6 `.md`) | ✅ |

## Summary

```json
{
  "status": "pass",
  "checks": [
    {"criterion": "API test suite (479 tests)", "result": "pass", "evidence": "41 files passed, 1 skipped"},
    {"criterion": "Web test suite (239 tests)", "result": "pass", "evidence": "31 files passed"},
    {"criterion": "Typecheck (3 packages)", "result": "pass", "evidence": "contracts + api + web clean"},
    {"criterion": "ai-prompt-engine (R1-R12)", "result": "pass", "evidence": "All 12 requirements verified in code + tests"},
    {"criterion": "ai-dynamic-groups (R1-R6)", "result": "pass", "evidence": "All 6 requirements verified in code + tests"},
    {"criterion": "shared-contracts (5 requirements)", "result": "pass", "evidence": "Schemas widened correctly, migrations present"},
    {"criterion": "ai-error-resilience (3 requirements)", "result": "pass", "evidence": "Retry chain + bootstrap validation implemented"},
    {"criterion": "ai-model-router (R1-R7)", "result": "pass", "evidence": "All 7 requirements verified, 15 tests pass"},
    {"criterion": "ai-dynamic-few-shot (R1-R6)", "result": "pass", "evidence": "All 6 requirements verified, 5 tests pass"},
    {"criterion": "manual-entity-creation: fallback label", "result": "warning", "evidence": "label: 'SIN_CLASIFICAR' vs spec label: ''"},
    {"criterion": "manual-entity-creation: dynamic groups in classify-span", "result": "warning", "evidence": "resolve() called without templateId — dynamic groups not recognized"},
    {"criterion": "manual-entity-creation: UI (+ AGREGAR CAMPO, modal)", "result": "pass", "evidence": "EntityInspector + EntityEditModal verified"}
  ],
  "next": "ready-for-archive"
}
```

**Verdict**: Implementation is solid. 718 tests green, typecheck clean, all MUST requirements met. Two warnings (W1: cosmetic label divergence, W2: classify-span missing templateId for dynamic group resolution) are non-blocking but should be addressed before or during archive.
