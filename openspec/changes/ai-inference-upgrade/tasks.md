# Tasks: ai-inference-upgrade

## Review Workload Forecast

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

8 PR slices, ~2,300 lines, TDD. Tracker `feature/ai-inference-upgrade` (no-merge).

## Phase 1: PR#1 — Foundation

- [x] 1.1 RED `schemas.test.ts`: `group: z.string().min(1)` — GENERAL/dynamic pass, empty rejected
- [x] 1.2 GREEN `schemas.ts`: widen `group`; add `reviewedAt`+`suggestedGroupsStatus`; export `SEED_GROUPS`,`GENERAL`,`OTROS`
- [x] 1.3 3 SQL migrations: `0015` group CHECK, `0016` `reviewed_at`+idx, `0017` `suggested_groups_status` JSONB
- [x] 1.4 RED+GREEN `entities.repository.ts/spec.ts`: `reviewed_at` map + `findReviewedForFewShot`
- [x] 1.5 RED+GREEN `templates.repository.ts/spec.ts`: `suggested_groups_status` map + `updateSuggestedGroups`

## Phase 2: PR#2 — PromptEngine + .md

- [x] 2.1 RED `prompt-engine.spec.ts`: load/render/renderWithSafety + `PromptRenderError` + `PromptTemplateNotFoundError`
- [x] 2.2 GREEN `prompt-engine.ts` (lazy `Map`, `{{var}}`, safety prepend)
- [x] 2.3 create 6 .md: `_shared/safety`, `extraction/system`, `classification/system`, `generation/{with-base,no-base,verification}`
- [x] 2.4 `nest-cli.json` assets copy `ai/prompts/**/*.md`; register `PromptEngine`

## Phase 3: PR#3 — ModelRouter

- [x] 3.1 RED `model-router.spec.ts`: disabled→AI_MODEL, per-task, fallback dedup, both-unset+WARNING, bootstrap fail, dev ignores vars
- [x] 3.2 GREEN `model-router.ts`: `resolveModel`, `resolveModelChain`, `validateRouterConfig`, `AiTask`
- [x] 3.3 `config/ai.ts/spec.ts`: router vars + `AI_MODEL_FALLBACK`; bootstrap throws on router+!AI_MODEL

## Phase 4: PR#4 — FewShotProvider + GroupsService

- [x] 4.1 RED `few-shot-provider.spec.ts`: 3-most-recent, excluded filtered, empty→"", budget truncate+WARNING
- [x] 4.2 GREEN `few-shot-provider.ts`: `getExamples`, `formatBlock`, 25% `AI_MAX_TOKENS` cap, query fail→""+WARNING
- [x] 4.3 RED `groups.service.spec.ts`: naming validation, approve→joins, reject→GENERAL
- [x] 4.4 GREEN `groups.service.ts`: `resolve`, `approve/reject` via `TemplatesRepository` + entity reassignment
- [x] 4.5 register both in `ai.module.ts`

## Phase 5: PR#5 — OpenRouterService + DocumentAnalysisService

- [ ] 5.1 RED rewrite `open-router.service.spec.ts`: prompt assertion; `suggestedGroups` parse+validate; cache key has userId+groups
- [ ] 5.2 GREEN `open-router.service.ts`: drop hardcoded prompts; inject `PromptEngine`+`ModelRouter`; widen `group`→string; add `suggestedGroups`; new `extractEntities(input)`
- [ ] 5.3 GREEN `callWithRetryChain`: 3 attempts primary + 1 per fallback; `CONFIG_ERROR` aborts
- [ ] 5.4 RED+GREEN rewrite `document-analysis.service.ts/spec.ts`: `analyze(file, userId, templateId?)` threads few-shot+groups via PromptEngine

## Phase 6: PR#6 — VerificationService + DocumentGenerationService

- [x] 6.1 RED `verification.service.spec.ts`: `[COMPLETAR]` detected, clean→passed, degraded on model fail
- [x] 6.2 GREEN `verification.service.ts` `verify()`: `AI_MODEL_FALLBACK ?? AI_MODEL`, max_tokens 2048, temp 0; never blocks
- [x] 6.3 `schemas.ts`: `GenerateDocumentResponseSchema` add `verification:{passed,completarCount,warnings,degraded}` + tests
- [x] 6.4 RED+GREEN rewrite `document-generation.service.ts/spec.ts`: consume PromptEngine, call verify, return `verification`; register

## Phase 7: PR#7 — ReviewService fallback

- [ ] 7.1 RED `review.service.spec.ts`: unknown group→GENERAL; malformed JSON→`{label:"",group:"GENERAL",value:inputText}`
- [ ] 7.2 GREEN `review.service.ts`: pass `groups` to `classifySpan`; unknown→`GENERAL`; malformed→fallback entity
- [ ] 7.3 RED+GREEN `open-router.service.ts` `classifySpan`: accept `groups`, render via PromptEngine

## Phase 8: PR#8 — Frontend

- [ ] 8.1 `apps/web/src/lib/case/groupEntities.ts`: add GENERAL/OTROS to GROUP_ORDER
- [ ] 8.2 `CaseFormSection.tsx`: generic group lookup; `+ AGREGAR CAMPO` in all headers
- [ ] 8.3 create approval-chip component for `suggestedGroupsStatus` (✓ Aprobar / ✗ Rechazar)
- [ ] 8.4 `EntityEditModal`/`EntityCreateModal`: dropdown includes seed + dynamic; pre-fill GENERAL on fallback
- [ ] 8.5 component tests: dynamic group rendering, approval chip, dropdown

## Phase 9: Verification

- [ ] 9.1 test suites green; migrations apply; prompts in dist
- [ ] 9.2 merge tracker after 8 PRs reviewed
