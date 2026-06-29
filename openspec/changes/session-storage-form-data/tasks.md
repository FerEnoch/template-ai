# Tasks: session-storage-form-data

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~510 additions / ~5 modifications (new `caseFormStorage.ts` ~70, tests ~370, contract + context + page edits ~70) |
| 400-line budget risk | Medium |
| Chained PRs recommended | No (per `single-pr-default` strategy) |
| Suggested split | Single PR with 4 work-unit commits |
| Delivery strategy | single-pr-default |
| Chain strategy | size-exception |

Decision needed before apply: Yes
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Commit | Notes |
|------|------|--------|-------|
| 1 | Add `CaseFormDraftSchema` to contracts | `feat(contracts): add CaseFormDraftSchema` | Schema + type + index re-export + test |
| 2 | Add sessionStorage storage module | `feat(case): add caseFormStorage adapter` | `load/save/clearCaseFormDraft` + tests + barrel |
| 3 | Wire hydrate + debounced write + `clearDraft` in `CaseProvider` | `feat(case): hydrate and persist case-form draft in CaseProvider` | 2 effects + ref + callback + provider tests |
| 4 | Clear draft on save/generate success in page | `feat(nuevo): clear sessionStorage draft on save and generate` | `clearDraft` calls in `page.tsx` + final verify |

## Phase 1: Contract — `CaseFormDraftSchema`

- [x] 1.1 RED: add test in `packages/contracts/src/__tests__/` asserting `CaseFormDraftSchema` parses valid shape and rejects missing fields
- [x] 1.2 GREEN: add `CaseFormDraftSchema` and `type CaseFormDraft` in `packages/contracts/src/schemas.ts` after `WizardDraftSchema`
- [x] 1.3 Re-export schema + type from `packages/contracts/src/index.ts`

## Phase 2: Storage Module — `caseFormStorage.ts`

- [x] 2.1 RED: create `apps/web/src/lib/case/__tests__/caseFormStorage.test.ts` with round-trip, invalid JSON clears, schema-violation clears, missing `window`/`sessionStorage`, quota-throw degrades silently
- [x] 2.2 GREEN: create `apps/web/src/lib/case/caseFormStorage.ts` with `DRAFT_KEY = "case-form-draft:v1"` and `load/save/clearCaseFormDraft` (mirror `apps/web/src/lib/wizard/storage.ts`, swap `localStorage` → `sessionStorage`)
- [x] 2.3 Create `apps/web/src/lib/case/index.ts` re-exporting the three storage functions (mirror `wizard/index.ts`)
- [x] 2.4 Run `pnpm --filter @template-ai/web test apps/web/src/lib/case/__tests__/caseFormStorage.test.ts` — all green

## Phase 3: CaseProvider — hydrate, debounced write, `clearDraft`

- [x] 3.1 RED: in `CaseContext.test.tsx`, add provider-level block: hydrate on mount w/ matching `caseId` (R3), stale-key drop (R4), debounced `setItem` after `UPDATE_FIELD` (R2), `clearDraft()` removes key (R5)
- [x] 3.2 GREEN: in `CaseContext.tsx`, add `lastHydratedCaseId` ref + hydrate `useEffect` on `[state.caseId, state.template]` (R3 ref guard, R4 intersect entities)
- [x] 3.3 GREEN: add debounced-write `useEffect` on `[state.caseId, state.template, state.formData]`, 300ms `setTimeout`, `clearTimeout` cleanup (R2)
- [x] 3.4 GREEN: add `clearDraft` `useCallback`; extend `CaseContextValue` and provider value (R5)
- [x] 3.5 Confirm existing `caseReducer` tests still pass; refactor if needed

## Phase 4: Page Wire-up + Final Verification

- [x] 4.1 In `apps/web/src/app/nuevo/[templateId]/page.tsx`, destructure `clearDraft` from `useCase()`
- [x] 4.2 Call `clearDraft()` after `await saveForm()` resolves inside `handleSave`'s try block (R5, no clear on save fail)
- [x] 4.3 Call `clearDraft()` after successful `router.push` in `handleGenerate` (R5)
- [x] 4.4 Run `pnpm --filter @template-ai/web test`, `pnpm typecheck`, `pnpm lint`, `pnpm format` — all pass
- [x] 4.5 Verify no regression: 30s auto-save fires, wizard `localStorage` unaffected, generation path intact
