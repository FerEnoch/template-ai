# Design: ai-inference-upgrade

## Technical Approach

Decompose the monolithic `OpenRouterService` (hardcoded prompts, single model, 4-group enum) into a layered inference stack: **PromptEngine** (loadable `.md` templates) → **ModelRouter** (per-task resolution, prod-only) → **FewShotProvider** (reviewed-entity injection) → **DynamicGroups** (model-suggested + user-approved) → **VerificationService** (post-generation `[COMPLETAR]` scan). The three existing services become thin orchestrators that consume these components. Contracts (`packages/contracts`) widen `group` to a non-empty string and add `reviewedAt` + `suggestedGroupsStatus`.

## Architecture Overview

```
DocumentAnalysisService.analyze(file, userId, templateId?)
   │ 1. extractText (pdf/docx) — unchanged
   │ 2. FewShotProvider.getExamples(userId) → {{fewShot}}
   │ 3. GroupsResolver.resolve(templateId) → {{groups}} (seed + approved)
   │ 4. PromptEngine.renderWithSafety("extraction", {documentText, fewShot, groups})
   ▼
OpenRouterService.extractEntities({documentText, userId, groups})
   │ ModelRouter.resolveModelChain("extraction") → [primary, fallback...]
   │ callWithRetryChain(task, prompt) → 3 attempts primary + 1 per fallback
   │ parse → AiEntitySchema (group: string) + suggestedGroups (validated)
   ▼
ReviewService.classifySpan → PromptEngine("classification") + {{groups}} → GENERAL fallback on unknown
DocumentGenerationService.generate → PromptEngine("generation") → verifyGeneration (cheap model)
```

## Architecture Decisions

| Decision | Choice | Alternatives | Rationale |
|---|---|---|---|
| Prompt storage | `.md` files in `src/ai/prompts/`, copied to `dist/` via NestJS `nest-cli.json` `assets` | Inline TS template strings; DB-stored prompts | Spec R1 mandates loadable files; co-located with engine → `import.meta.url` resolves in src & dist. Git = versioning (R11). |
| Prompt loading | Lazy on first `load()`, cached in `Map` | Eager at bootstrap | Fast startup; missing-file errors surface at first use, not boot. Satisfies R1 "cache in memory". |
| Router resolution | Per-call, returns ordered chain `[perTask?, FALLBACK?, AI_MODEL]` (deduped, ≤2) | Once-cached resolution | Spec note: "per-call, not cached, to allow runtime reconfiguration". |
| Retry policy | 3 attempts on primary model + 1 attempt on each fallback model; `CONFIG_ERROR` aborts all | 3-per-model-in-chain (literal MODIFIED spec) | Bounds latency (generation is already 30–60s); honours ADDED "one additional retry via fallback chain". Spec wording tension flagged in Open Questions. |
| Verification model | `AI_MODEL_FALLBACK ?? AI_MODEL`, max_tokens 2048, temp 0 | New 4th router task `verification` | Router spec R2 fixes three tasks; reusing the cheap fallback avoids touching R2. |
| Verification strictness | Soft — warnings surfaced, does NOT block download | Hard fail | Spec R4 scenario: "does NOT block download". Resolves proposal open-question 3. |
| Group approval UX | Inline chips in review step | Separate "group library" settings page | Spec R2 mandates inline chip; minimal frontend scope (proposal non-goal). Resolves open-question 1. |
| Few-shot selection | `ORDER BY reviewed_at DESC LIMIT 3` (spec R3) | Semantic/vector selection | Proposal non-goal: no embeddings. Resolves open-question 2. |
| Dynamic group persistence | New `templates.suggested_groups_status JSONB` column | Overload `entities JSONB` | Clean separation; queryable. **Requires migration** (see Migration). |
| `group` enum → string | `z.string().min(1)` in contracts + drop DB CHECK | Widen enum to include GENERAL/OTROS | Dynamic groups are arbitrary strings; enum can't be closed. |

## Data Flow

### Extraction with few-shot + dynamic groups
`analyze(file, userId, templateId?)` → extract text → `FewShotProvider.getExamples(userId)` (cross-document, `reviewed=true AND excluded=false`, `ORDER BY reviewed_at DESC LIMIT 3`, budget-capped at 25% of `AI_MAX_TOKENS`) → `GroupsResolver.resolve(templateId)` (seed `PARTES,INMUEBLE,FECHAS,ANEXOS,GENERAL,OTROS` + template's approved dynamic groups) → `PromptEngine.renderWithSafety("extraction", {documentText, fewShot, groups})` → `ModelRouter.resolveModelChain("extraction")` → retry-chain call → parse entities (`group: string`) + `suggestedGroups` (naming-validated: 2–30 uppercase alnum + `/`, invalid discarded + WARNING) → `validateAndCorrectSpans` (unchanged, group-agnostic) → return.

### Generation with verification
`CasesService.generate` (unchanged orchestration) → `DocumentGenerationService.generate` → `PromptEngine.renderWithSafety("generation" | "generation-no-base", {entities, formData, baseText})` → router chain `generation` → parse `generatedText` → `VerificationService.verify(generatedText)` (cheap model, scans `[COMPLETAR]` count/positions + non-empty structure) → `GenerateResult` gains `verification: {passed, completarCount, warnings, degraded}`. `CasesService` returns warnings (non-blocking). Verification failure degrades to `degraded:true` (never blocks).

### Group approval
Model emits `suggestedGroups: ["JORNADA"]` → persisted as `suggestedGroupsStatus: {JORNADA:"pending"}` on template → review step renders chip → approve → `GroupsService.approve(templateId, "JORNADA")` sets status `approved` (joins `{{groups}}` next extraction) → reject → status `rejected`, entities in that group reassigned `GENERAL`, chip removed.

## File Changes

| File | Action | Description |
|---|---|---|
| `apps/api/src/ai/prompts/_shared/safety.md` | Create | `SAFETY_PREAMBLE` (honesty, no-inference, privacy). |
| `apps/api/src/ai/prompts/extraction/system.md` | Create | CoT directive (R3), confidence criteria (R7), don't-invent (R8), `{{groups}}`, `{{fewShot}}`. |
| `apps/api/src/ai/prompts/classification/system.md` | Create | `{{groups}}`-aware span classifier. |
| `apps/api/src/ai/prompts/generation/with-base.md`, `no-base.md` | Create | `[COMPLETAR]` guidelines (R5), tone (R6), conflict rules (R10). |
| `apps/api/src/ai/prompts/generation/verification.md` | Create | `[COMPLETAR]` scan + structure check. |
| `apps/api/src/ai/prompt-engine.ts` | Create | `PromptEngine`: `load`, `render`, `renderWithSafety`; `PromptRenderError`, `PromptTemplateNotFoundError`. |
| `apps/api/src/ai/model-router.ts` | Create | `resolveModel(task)`, `resolveModelChain(task)`, `AiTask` union, bootstrap `validateRouterConfig`. |
| `apps/api/src/ai/few-shot-provider.ts` | Create | `FewShotProvider.getExamples(userId)`, `formatBlock`, budget cap. |
| `apps/api/src/ai/groups.service.ts` | Create | `GroupsResolver.resolve(templateId)`, `approve/reject`, naming validation. |
| `apps/api/src/ai/verification.service.ts` | Create | `verify(generatedText)` via cheap model. |
| `apps/api/src/ai/open-router.service.ts` | Modify | Remove hardcoded prompts/enums; inject `PromptEngine`+router; widen `AiEntitySchema.group`→string; add `suggestedGroups`; new signatures `(input:{documentText,userId,groups})`; add `verifyGeneration`. |
| `apps/api/src/ai/document-analysis.service.ts` | Modify | Thread `userId`+`templateId`; inject few-shot + groups; route via PromptEngine. |
| `apps/api/src/ai/document-generation.service.ts` | Modify | Consume PromptEngine; call VerificationService; return `verification`. |
| `apps/api/src/ai/ai.module.ts` | Modify | Register new providers; keep `CacheModule` import. |
| `apps/api/src/config/ai.ts` | Modify | Add `AI_MODEL_ROUTER_ENABLED` + per-task env vars + bootstrap validation (extends token-budget validation). |
| `apps/api/src/review/review.service.ts` | Modify | `classifySpan` GENERAL fallback on unknown/malformed; dynamic-group dropdown source; suggestedGroups persistence. |
| `packages/contracts/src/schemas.ts` | Modify | `EntitySchema.group`→`z.string().min(1)`; add `reviewedAt`; `ClassifySpanResponseSchema.group`→string; `TemplateSchema.suggestedGroupsStatus`; export `SEED_GROUPS`, `GENERAL`, `OTROS`. |
| `apps/api/src/infrastructure/postgres/migrations/0015_entities_group_dynamic.sql` | Create | Drop `entities_group_allowed` CHECK; add non-empty CHECK. |
| `apps/api/src/infrastructure/postgres/migrations/0016_entities_reviewed_at.sql` | Create | Add `reviewed_at TIMESTAMPTZ` + backfill + partial index. |
| `apps/api/src/infrastructure/postgres/migrations/0017_templates_suggested_groups.sql` | Create | Add `suggested_groups_status JSONB DEFAULT '{}'`. |
| `apps/api/src/infrastructure/postgres/repositories/entities.repository.ts` | Modify | Map `reviewed_at`; set `reviewed_at=now()` on reviewed→true, `null`→false; add `findReviewedForFewShot(userId)`. |
| `apps/api/src/infrastructure/postgres/repositories/templates.repository.ts` | Modify | Map `suggested_groups_status`; `updateSuggestedGroups`. |
| `apps/api/nest-cli.json` | Modify | `compilerOptions.assets`: copy `ai/prompts/**/*.md` to dist. |
| `apps/web` review step | Modify | Render dynamic group headers + `+ AGREGAR CAMPO` in GENERAL/OTROS/dynamic; approval chips; modal dropdown includes dynamic groups. |

## Interfaces / Contracts

```ts
// model-router.ts — non-obvious: returns ordered chain for retry layer
type AiTask = "extraction" | "classification" | "generation";
interface ModelResolution { model: string; source: "task"|"fallback"|"base"; chain: string[]; }
export function resolveModel(task: AiTask): string;          // primary only (for logging/trace)
export function resolveModelChain(task: AiTask): string[];   // deduped, ≤2, for retry layer

// few-shot-provider.ts — non-obvious: cross-document RLS query
// SELECT e.label,e.value,e."group",e.reviewed_at FROM entities e
// JOIN documents d ON d.id=e.document_id
// WHERE d.user_id=$1 AND e.reviewed AND NOT e.excluded AND e.reviewed_at IS NOT NULL
// ORDER BY e.reviewed_at DESC LIMIT 3;
export class FewShotProvider { getExamples(userId: number): Promise<ReviewedExample[]>; }

// open-router.service.ts — non-obvious: cache key MUST include userId+groups
const cacheKey = sha256(documentText + userId + groups.join(","));
// Non-obvious: OpenAI strict json_schema can't have optional fields → nullable array
suggestedGroups: { type: ["array","null"], items: { type: "string" } }  // in required[], null≈none

// contracts: group widening
group: z.string().min(1)               // was z.enum(["PARTES","INMUEBLE","FECHAS","ANEXOS"])
reviewedAt: z.string().datetime().nullable().optional()
suggestedGroupsStatus: z.record(z.string(), z.enum(["pending","approved","rejected"])).optional()
```

## Error Handling Strategy

- **Router**: `CONFIG_ERROR` (401/404) aborts the whole chain immediately — no fallback retry (spec). `RATE_LIMIT`/`NETWORK_ERROR`/`INVALID_RESPONSE` retryable. Each fallback step logs WARNING with reason.
- **Bootstrap**: `AI_MODEL_ROUTER_ENABLED=true` + empty `AI_MODEL` → throw at import (fail fast). Missing per-task vars → WARNING, startup succeeds. Router disabled → no router vars read (R5).
- **PromptEngine**: missing file → `PromptTemplateNotFoundError` (load time); missing var → `PromptRenderError` (render time, includes var name).
- **FewShot**: empty → `""` (no error). Budget exceeded → truncate to 1 + WARNING. Query failure → degrade to `""` + WARNING (never blocks extraction).
- **Verification**: cheap-model call failure → `degraded:true`, `passed:true`, never blocks generation/download.
- **classifySpan fallback**: unknown group or malformed JSON → override `group:"GENERAL"`, open modal pre-filled (spec manual-entity-creation ADDED).

## Testing Strategy (strict TDD — RED-GREEN-REFACTOR)

| Layer | Target | Approach |
|---|---|---|
| Unit | `PromptEngine` | render/interpolation/missing-var/missing-file/safety-prepend (spec R1/R2 scenarios). |
| Unit | `ModelRouter` | disabled→AI_MODEL; per-task; fallback chain; both-unset→AI_MODEL+WARNING; bootstrap fail; dev ignores router vars (R1–R7 scenarios). |
| Unit | `FewShotProvider` | mock repo: 3-most-recent; excluded filtered; empty→""; budget cap truncate+WARNING; cross-document (R1–R6). |
| Unit | `GroupsService` | naming validation (invalid discarded+WARNING); approve→joins groups; reject→entities→GENERAL. |
| Unit | `VerificationService` | `[COMPLETAR]` detected; clean→passed; degraded on model failure. |
| Unit | `OpenRouterService` | mocked PromptEngine+router: **prompt-content assertion** (success criterion: user's 3 corrections appear in `{{fewShot}}`); `suggestedGroups` parse+validate; cache key includes userId. |
| Unit | contracts `schemas.test.ts` | group=GENERAL/dynamic pass; empty rejected; reviewedAt optional; suggestedGroupsStatus optional. |
| Integration | `review.service` | classify-span unknown→GENERAL fallback; entity persist with GENERAL (migration applied in test DB). |
| Regression | full `pnpm --filter @template-ai/api test` | existing suite green; existing entities (4-group) still validate. |

## Migration / Compatibility

**⚠️ BLOCKER — contradicts proposal rollback plan item 5 ("No DB migrations are introduced").** Codebase inspection reveals the `entities` table has a DB-level `CHECK ("group" IN ('PARTES','INMUEBLE','FECHAS','ANEXOS'))` (migration 0002) and **no `reviewed_at`** column. The specs **require** both `GENERAL`/dynamic group persistence (ai-dynamic-groups R4, shared-contracts, manual-entity-creation) and `ORDER BY reviewed_at DESC` (ai-dynamic-few-shot R3). These are impossible without 3 minimal additive migrations:

1. `0015_entities_group_dynamic.sql` — `ALTER TABLE entities DROP CONSTRAINT entities_group_allowed;` + `CHECK (length(btrim("group"))>0)`.
2. `0016_entities_reviewed_at.sql` — `ADD COLUMN reviewed_at TIMESTAMPTZ`; backfill `WHERE reviewed`; partial index `WHERE reviewed AND NOT excluded`.
3. `0017_templates_suggested_groups.sql` — `ADD COLUMN suggested_groups_status JSONB NOT NULL DEFAULT '{}'`.

**Backward compat**: `group` enum→string is additive (legacy `PARTES`.. still validate); `reviewedAt`/`suggestedGroupsStatus` optional (legacy entities/templates validate). Frontend must render unknown groups generically (proposal risk). The rollback plan **must be amended**: revert now requires re-adding the CHECK + dropping 2 columns (a real schema rollback), contradicting item 5. **Decision needed**: (a) accept the 3 migrations + amend rollback, or (b) descope dynamic-groups/GENERAL-persistence/few-shot to honour "no migrations". This design assumes (a).

## Open Questions

- [ ] **[BLOCKER]** Confirm migration approach (a) accept 3 additive migrations + amend rollback plan, or (b) descope — specs are unimplementable as-is under "no migrations".
- [ ] Retry policy: this design uses "3 on primary + 1 per fallback"; spec MODIFIED says "3 per model in chain". Confirm interpretation (latency vs. literal).
- [ ] `confidence` case: shared-contracts spec says `alta/media/baja` (lowercase) but code+DB use `ALTA/MEDIA/BAJA` (DB CHECK enforces uppercase). Keep uppercase — confirm spec wording fix.
- [ ] Verification: reuse `AI_MODEL_FALLBACK` (this design) vs. add 4th router task `AI_MODEL_VERIFICATION` (would amend router spec R2).
- [ ] Extraction cache key change (add userId+groups) may reduce hit rate — acceptable?
