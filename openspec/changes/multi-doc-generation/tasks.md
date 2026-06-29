# Tasks: Fix Multi-Document Generation Bug

## Review Workload Forecast

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Medium
Estimated changed lines: 300–400 (backend ~120 incl. tests, frontend ~220 incl. new test file).
Split: single PR — all three layers ship atomically. If `page.test.tsx` exceeds 120 lines, re-split into chained PRs and re-evaluate.

## Phase 1: Backend RED — failing tests for idempotent POST

- [ ] 1.1 `cases.controller.integration.spec.ts`: two sequential `POST /api/cases` same `(user, template)` → same id, statuses 201 then 200, no second INSERT.
- [ ] 1.2 `cases.service.spec.ts`: when `findBorradorByUserAndTemplate` returns a row, `create` returns `{ case, created: false }` and never calls `repo.create`.
- [ ] 1.3 `cases.repository.spec.ts`: insert two borradores same `(user, template)`; find returns the older one (`ORDER BY created_at ASC LIMIT 1`).
- [ ] 1.4 `pnpm --filter @template-ai/api test` — confirm 1.1–1.3 fail for the right reason.

## Phase 2: Backend GREEN — repo, service, controller

- [ ] 2.1 `cases.repository.ts`: add `findBorradorByUserAndTemplate(userId, templateId)` reusing `CASE_SELECT`/`CASE_JOIN`; `WHERE c.user_id=$1 AND c.template_id=$2 AND c.status='borrador' ORDER BY c.created_at ASC LIMIT 1`.
- [ ] 2.2 `cases.service.ts`: `create` returns `{ case: CaseResponse, created: boolean }`; find-before-insert inside existing `withOwnerTransaction`.
- [ ] 2.3 `cases.controller.ts`: accept `@Res({ passthrough: true }) res`; unwrap `{ case, created }`; `res.status(created ? 201 : 200)`; return `case`.
- [ ] 2.4 `pnpm --filter @template-ai/api test` — 1.1–1.3 pass; full suite green.

## Phase 3: Frontend RED — failing test for in-flight guards

- [ ] 3.1 Create `nuevo/[templateId]/__tests__/page.test.tsx` with: StrictMode double-mount → one POST (MSW counter); unmount during in-flight → `signal.aborted === true`; two Generar clicks same tick → `generateCase` called once; ref resets after `generateCase` throws.
- [ ] 3.2 `pnpm --filter @template-ai/web test` — confirm 3.1 fails for the right reason.

## Phase 4: Frontend GREEN — `safeFetch` signal, `useRef` guards

- [ ] 4.1 `apps/web/src/lib/api/cases.ts`: add optional `signal?: AbortSignal` to `safeFetch`, `fetchTemplate`, `createCase`; pass into `fetch`.
- [ ] 4.2 `nuevo/[templateId]/page.tsx`: replace `cancelled` with `useRef<boolean>` `bootstrapInFlight` (sync check-and-set); own one `AbortController` aborted on cleanup; thread `signal` into `fetchTemplate`/`createCase`; ignore `AbortError`; add `useRef<boolean>` `generationInFlight` in `handleGenerate`, reset in `finally`.
- [ ] 4.3 `preview/[caseId]/page.tsx`: add `useRef<boolean>` `regenerateInFlight` in `handleRegenerate` with same check-before-async + reset-in-finally.
- [ ] 4.4 `pnpm --filter @template-ai/web test` — 3.1 passes; full suite green.

## Phase 5: Verification

- [ ] 5.1 `pnpm --filter @template-ai/api test` and `pnpm --filter @template-ai/web test` green from clean clone.
- [ ] 5.2 Manual smoke: `/nuevo/[id]` → fill → Generar → `/biblioteca` shows one `generado` case; reload `/nuevo/[id]` produces no second row.
- [ ] 5.3 `git diff --stat` under 400 changed lines; if over, re-split per `work-unit-commits` skill and switch to chained PRs.
- [ ] 5.4 Open PR `fix: idempotent bootstrap and POST /api/cases (multi-doc-generation)` referencing this change folder.
