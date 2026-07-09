# Tasks: Inline Rename for Templates & Documents

## Review Workload Forecast

Estimated changed lines: ~615. Strategy: `single-pr-default`.

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Work Units

| Unit | Goal | PR |
|------|------|-----|
| 1 | Contracts + migration `0011_casos_name` | PR 1 |
| 2 | Backend PATCH `/api/templates/:id` + `/api/cases/:id` (svc/repo/ctrl + tests) | PR 1 |
| 3 | `EditableName` component + Vitest | PR 2 |
| 4 | API clients + `TemplateCard`/`CaseList`/`/biblioteca` wiring + Vitest | PR 2 |
| 5 | Playwright E2E spec | PR 2 |

> Confirm before apply: allow rename on `archivado`? (Design assumes yes.)

## Phase 1: Contracts & Migration (PR 1)

- [ ] 1.1 Add `UpdateTemplateNameSchema` (`trim().min(3).max(200)`), `name?` on `CaseSchema`/`UpdateCaseFormDataSchema` in `packages/contracts/src/schemas.ts`
- [ ] 1.2 Re-export new types from `packages/contracts/src/index.ts`
- [ ] 1.3 RED→GREEN: extend `schemas.test.ts` (valid, empty, nullable backward-compat)
- [ ] 1.4 Create `migrations/0011_casos_name.sql`: `ALTER TABLE casos ADD COLUMN IF NOT EXISTS name TEXT` (nullable)

## Phase 2: Backend — Templates PATCH (PR 1)

- [ ] 2.1 RED→GREEN: add `updateName` tests in `templates.service.spec.ts` (happy, 23505→ConflictException, missing→NotFoundException)
- [ ] 2.2 Add `updateName(userId, id, name)` in `templates.service.ts` reusing `isUniqueViolation`
- [ ] 2.3 Add `updateName(id, name)` with `UPDATE … RETURNING` in `templates.repository.ts`
- [ ] 2.4 Add `@Patch(':id')` handler validating `UpdateTemplateNameSchema` in `templates.controller.ts`
- [ ] 2.5 RED→GREEN: extend `templates.controller.integration.spec.ts` (happy, 409 dup, 404 cross-user), `DATABASE_URL`-gated

## Phase 3: Backend — Cases PATCH (PR 1)

- [ ] 3.1 RED→GREEN: add `cases.service.spec.ts` tests (happy, null passthrough, 404 cross-user)
- [ ] 3.2 Add `updateName(userId, id, name)` in `cases.service.ts`; include `name` in `mapToResponse`
- [ ] 3.3 Add `c.name` to `CASE_SELECT`, `name` to `CaseRecord`/`rowToCase`, `updateName` in `cases.repository.ts`
- [ ] 3.4 Route optional `name` from `UpdateCaseFormDataSchema` to `casesService.updateName` in `cases.controller.ts`
- [ ] 3.5 RED→GREEN: add `cases.controller.integration.spec.ts` (rename happy, 404 cross-user RLS)

## Phase 4: Frontend — `EditableName` (PR 2)

- [ ] 4.1 Create `EditableName.tsx` with `useTransition` save + `useRef` focus/select-all; `stopPropagation` on wrapper
- [ ] 4.2 RED→GREEN: add `EditableName.test.tsx` (happy, Escape, empty→inline error, onSave throw→rollback, click-isolation spy)

## Phase 5: Frontend — API Client & Wiring (PR 2)

- [ ] 5.1 Create `lib/api/templates.ts` with `updateTemplateName(id, name)` (mirrors `cases.ts` `ApiError`/`safeFetch`)
- [ ] 5.2 Extend `updateCase` in `lib/api/cases.ts` to send optional `name`
- [ ] 5.3 Wrap `<h3>` in `<EditableName>` in `TemplateCard.tsx`; thread `onRename` callback
- [ ] 5.4 In `CaseList.tsx` display `case.name ?? templateName`; wrap in `<EditableName>`
- [ ] 5.5 Add `onRenameTemplate`/`onRenameCase` updating local state in `/biblioteca` page
- [ ] 5.6 RED→GREEN: Vitest for `TemplateCard`/`CaseList` with mocked `onSave`; verify fallback

## Phase 6: E2E & Verification (PR 2)

- [ ] 6.1 Add Playwright `e2e/inline-rename.spec.ts` (rename template, rename case, Escape cancel, 409 rollback)
- [ ] 6.2 Run `pnpm --filter @template-ai/contracts test && @template-ai/api test && @template-ai/web test` — all green
- [ ] 6.3 Run `pnpm typecheck && pnpm lint && pnpm format` — all green

## Phase 7: Cleanup

- [ ] 7.1 Confirm `pnpm build` succeeds for `apps/api` and `apps/web`; re-verify Rollback Plan in `proposal.md`
