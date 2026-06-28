# Proposal: session-storage-form-data

## Intent

The new-case form at `/nuevo/[templateId]` (`apps/web/src/app/nuevo/[templateId]/page.tsx` + `apps/web/src/lib/case/CaseContext.tsx`) keeps `formData` in a transient React `useReducer`. Today, navigating to home, refreshing, or using browser back/forward **discards every field the user typed** — even though the case still exists on the server in `borrador` state. The 30s server auto-save (`PATCH /api/cases/:id`) only fires while the form is mounted, so any in-flight, un-flushed work is lost on unmount. This change adds a `sessionStorage`-backed "draft" so the user's work survives unmount, back/forward navigation, and quick trips to the home screen, while still being cleared automatically when the tab closes.

The wizard already has an equivalent pattern in `apps/web/src/lib/wizard/storage.ts` (key `template-draft:v1`, `localStorage`, Zod-validated). We mirror that contract for the new-case flow but use **`sessionStorage` per the requirement** and scope the data to the new-case form.

## Scope

### In Scope
- New `CaseFormDraftSchema` (Zod) in `packages/contracts/src/schemas.ts` with `caseId`, `templateId`, `formData`, `savedAt`
- New module `apps/web/src/lib/case/caseFormStorage.ts` — `loadCaseFormDraft()`, `saveCaseFormDraft()`, `clearCaseFormDraft()` keyed `case-form-draft:v1` in `sessionStorage`
- `CaseProvider` hydrates `formData` from the draft on mount (only when `caseId` matches) and writes on every `UPDATE_FIELD` (debounced 300ms)
- `clearCaseFormDraft()` called on `handleGenerate` success (status transitions to `generado`) and on `handleSave` success (so a clean "definitive" save clears local draft — server is source of truth)
- Draft restored automatically on remount within the same tab; `formData` keys for entities no longer in the template are dropped on load (stale-key filter)
- Vitest unit tests for the storage module and a `useEffect`/`UPDATE_FIELD` integration test on `CaseProvider`

### Out of Scope
- Backend changes, new endpoints, DB columns (server `form_data` already exists; this is a client-side cache)
- Cross-tab draft sync (sessionStorage is per-tab by design)
- A home-page "drafts" list UI (proposal question round below)
- Server-side draft as a backup or durable persistence beyond the existing 30s auto-save
- Changes to the wizard's `localStorage` draft (`template-draft:v1`) — distinct key, distinct flow
- Migration of users' existing in-flight work (cases in `borrador` on the server are still recoverable via `GET /api/cases/:id`)

## Capabilities

> Contract for `sdd-spec`. Note: `case-form-rendering` and `case-management` live in `openspec/changes/new-case-flow/specs/` (not yet archived to `openspec/specs/`). This proposal is implementable in parallel and the delta will fold in during archive.

### New Capabilities
- `case-form-draft` — sessionStorage draft persistence for the new-case form: write-on-change, hydrate-on-mount, clear-on-definitive-save, stale-key filtering

### Modified Capabilities
- `case-form-rendering` (delta in the in-flight `new-case-flow` change) — Add a Requirement: "On mount, the form MUST hydrate `formData` from `case-form-draft:v1` in `sessionStorage` if the stored `caseId` matches the current case. On every `UPDATE_FIELD`, the form MUST write the new `formData` to `sessionStorage` (debounced 300ms)."
- `case-management` (delta) — Add: "On successful state transition to `generado` (AI generation complete), the client MUST clear `case-form-draft:v1`." No backend changes; the `PATCH /api/cases/:id` server contract is untouched.

## Approach

**Storage layer** (`apps/web/src/lib/case/caseFormStorage.ts`): mirror `apps/web/src/lib/wizard/storage.ts` — three functions, `typeof window === "undefined"` guards, JSON parse → `CaseFormDraftSchema.parse(...)` → on failure remove the key and return `null`. Key constant `DRAFT_KEY = "case-form-draft:v1"`. Exported via `apps/web/src/lib/case/index.ts` (create if absent, follow `apps/web/src/lib/wizard/index.ts` pattern).

**State integration** (`apps/web/src/lib/case/CaseContext.tsx`):
1. New ref `lastHydratedCaseId` to prevent re-hydrating when `setCase` is called with the same id after a save.
2. On `setCase` mount: if `sessionStorage` has a draft and `draft.caseId === caseItem.id`, dispatch `SET_FORM_DATA` with the draft's `formData` (intersected with current `template.entities[].id` to drop stale keys). Otherwise, if no draft, fall back to existing behavior (`setCase` with `caseItem.formData`).
3. Add a `useEffect` that watches `state.formData`; on change, debounce 300ms then call `saveCaseFormDraft({ caseId, templateId, formData })`. Reads `templateId` from `state.template?.id`.
4. Add a `clearDraft()` callback to the context value; called from `apps/web/src/app/nuevo/[templateId]/page.tsx` in `handleGenerate` (after `generateCase` resolves with status `generado`) and in `handleSave` (after `saveForm` resolves).

**Draft vs server auto-save coordination**: server 30s auto-save remains the source of truth. sessionStorage is a *write-through cache* on top of the existing reducer. On hydrate, if the server returns a newer `formData` than the draft, the server wins (we check `updatedAt` only if we extend the schema; for MVP, server wins by calling order — `setCase` is dispatched first, then any local edits overwrite via `UPDATE_FIELD`).

**Stale-key filter**: on hydrate, intersect `draft.formData` keys with `template.entities.map(e => e.id)`. Drop unknown keys. Prevents orphan data when a template's entity set changes between sessions.

**Tests** (`apps/web/src/lib/case/__tests__/`):
- `caseFormStorage.test.ts` — parallel to `storage.test.ts`: save/load/clear round-trip, invalid JSON clears, schema-violation clears, missing `window` returns null, distinguishes from `localStorage` (mock `sessionStorage` separately).
- Extend `CaseContext.test.tsx` (already exists): on mount with matching draft, `formData` is hydrated; on `UPDATE_FIELD`, sessionStorage write fires (debounced); on `clearDraft()`, key is removed.

**Performance** (`vercel-react-best-practices`):
- `rerender-defer-reads` / `rerender-derived-state-no-effect` — derive `formData` directly from reducer state; do not subscribe to it from a parent that doesn't render it.
- `js-cache-storage` — single `getItem`/`setItem` per debounce window.
- `rerender-lazy-state-init` — initial `CaseState` not extended; the hydration is in a `useEffect`, not a lazy initializer (because hydration depends on `setCase` payload).

**Error handling** (`error-handling-patterns`):
- All `sessionStorage` calls wrapped in `try/catch`; failures (quota exceeded, disabled storage) degrade silently — the form keeps working without the draft. No user-visible error for storage failures (they're not actionable).
- `setCase` hydration order: if hydrate dispatch throws (impossible in practice but defensive), fall through to server `formData` and log.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `packages/contracts/src/schemas.ts` | Modified | Add `CaseFormDraftSchema`; export from `index.ts` |
| `packages/contracts/src/index.ts` | Modified | Re-export `CaseFormDraftSchema` and `CaseFormDraft` type |
| `apps/web/src/lib/case/caseFormStorage.ts` | New | `loadCaseFormDraft`, `saveCaseFormDraft`, `clearCaseFormDraft` |
| `apps/web/src/lib/case/CaseContext.tsx` | Modified | Hydrate on `setCase`; debounced write on `formData` change; expose `clearDraft` |
| `apps/web/src/lib/case/index.ts` | New (or extended) | Re-export the storage module |
| `apps/web/src/app/nuevo/[templateId]/page.tsx` | Modified | Call `clearDraft()` after successful `handleGenerate` and `handleSave` |
| `apps/web/src/lib/case/__tests__/caseFormStorage.test.ts` | New | Unit tests (mirror `storage.test.ts`) |
| `apps/web/src/lib/case/__tests__/CaseContext.test.tsx` | Modified | Add hydrate + write + clear scenarios |
| `openspec/specs/case-form-draft/spec.md` | New (delta in change folder) | New capability spec |
| `openspec/changes/new-case-flow/specs/case-form-rendering/spec.md` | Modified (delta) | Add hydrate/write requirement |
| `openspec/changes/new-case-flow/specs/case-management/spec.md` | Modified (delta) | Add client-side clear on `generado` |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| `sessionStorage` unavailable (private mode, disabled cookies) | Low | All calls wrapped in `try/catch`; form still works, just no draft. Unit test with `Object.defineProperty(window, "sessionStorage", { value: undefined })`. |
| Stale entity keys survive template changes | Med | Intersect with `template.entities[].id` on hydrate; drop unknown keys. Document in the `case-form-draft` spec. |
| Conflict with server 30s auto-save | Low | Server remains source of truth. On remount, `setCase` re-fetches server `formData`; local sessionStorage draft only applied if it matches the current `caseId`. The 30s `PATCH` continues to run. |
| Multiple drafts in the same tab (different templates) | Low | Keyed per `caseId` in the schema; we keep ONE entry per `caseId`. If user starts two cases, each gets its own draft. Old drafts for closed tabs are gone (sessionStorage). |
| Quota exceeded (~5 MB) | Low | `formData` is `Record<string, string>` of ~10–20 fields × ~100 chars = a few KB. Quota is not a realistic concern. Defensive `try/catch` anyway. |
| SSR hydration mismatch | Low | All reads/writes guarded with `typeof window === "undefined"`. No access during render. |
| Draft leaks across users (shared computer) | Med | `sessionStorage` is per-tab; closes on tab close. Combined with server-side RLS isolation of the case, an attacker in the same tab session still cannot read another user's case (the draft is only written for the current `caseId` in the URL). Not a new risk class. |

## Rollback Plan

| Stage | Action |
|---|---|
| Feature merged, no users yet affected | Revert the PR. Delete `caseFormStorage.ts` and the `CaseFormDraftSchema`. Revert `CaseContext` to pre-hydration behavior. Zero data loss (no drafts saved yet). |
| Feature in production, drafts in flight | Revert the PR. In-flight drafts in `sessionStorage` are abandoned (sessionStorage is tab-local, will be GC'd). Users in the middle of filling a form may need to refresh and start over — but server-side `form_data` from the 30s auto-save is still intact, so re-loading `/nuevo/[templateId]?caseId=X` from server recovers all flushed data. |
| Bug discovered (e.g., wrong key, schema error) | Add a new schema version (`case-form-draft:v2`); old `v1` keys are ignored by `loadCaseFormDraft` (Zod parse fails → cleared). No need to redeploy the write path. |

## Dependencies

- `@template-ai/contracts` (existing) — adds the new Zod schema
- No new npm packages
- No backend changes
- No infrastructure changes

## Success Criteria

- [ ] `CaseFormDraftSchema` exported from `@template-ai/contracts` and round-trips through `JSON.parse` → `schema.parse` → `JSON.stringify`
- [ ] `caseFormStorage.ts` has unit tests covering: save, load, clear, invalid JSON, schema-violating data, missing `sessionStorage`, missing `window`
- [ ] `CaseProvider` writes to `sessionStorage` within 300ms of any `UPDATE_FIELD` (debounced)
- [ ] On remount with a matching `caseId`, `formData` is hydrated from sessionStorage before the first user interaction
- [ ] Stale entity keys (entity removed from template) are dropped on hydrate
- [ ] `handleGenerate` success → `sessionStorage` key removed; verified by integration test
- [ ] `handleSave` success → `sessionStorage` key removed; verified by integration test
- [ ] `pnpm --filter @template-ai/web test` passes; new tests added; coverage of new code ≥80%
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm format` all pass
- [ ] No regression in existing case-form auto-save (30s `PATCH` still fires), case generation, or the wizard's `localStorage` draft

## Open Questions — Proposal Round

The orchestrator (or the user via the orchestrator) should resolve these before `sdd-spec` is launched. Each has a default assumption; speak up to change any of them.

1. **Home drafts list (user flow 3)**: The user described "User goes to home screen, sees their 'draft' listed → selects it → form is restored". sessionStorage is per-tab, so the list is inherently per-tab and per-session. **Assumption**: the drafts list is **out of scope for this change** (added to "Out of Scope" above). The user's flow 3 works *within the same tab*: they leave `/nuevo/X` → go to `/` → click a "Continuar borrador" link that navigates back to `/nuevo/X`, and the form re-hydrates. The visual "list" on `/` is a single, simple "Continuar tu borrador en curso" banner, not a multi-entry list. **Alternative**: scope a real multi-entry drafts list (more UI, no backend; enumerate `sessionStorage` keys matching `case-form-draft:*`).

2. **Clear-on-save vs clear-on-generate**: server 30s auto-save fires on `handleSave` (status stays `borrador`). If we clear the draft on every `handleSave`, then a brief network blip during the auto-save could leave the user with no draft AND no flushed server data. **Assumption**: clear only on `handleGenerate` success (status `→ generado`) AND on explicit "Continuar más tarde" type dismissal. The 30s auto-save runs *in parallel* and updates server `form_data`; sessionStorage draft is cleared once status transitions to `generado`. **Alternative**: clear on every `handleSave` success — more aggressive, less data loss window, but loses the draft if server is briefly unreachable.

3. **Template-id-keyed drafts vs case-id-keyed drafts**: a `caseId` is only known *after* `POST /api/cases` succeeds. If the user types a few fields, then the bootstrap `createCase()` call fails, the fields are lost on retry. **Assumption**: key by `caseId` only (after bootstrap). Pre-bootstrap typing is impossible because the form only renders after `setCase` resolves. **Alternative**: key by `templateId` *before* `caseId` exists, then migrate to `caseId` after bootstrap — adds complexity, not justified by user value.

4. **Cross-tab drafts (e.g., user opens `/nuevo/X` in two tabs)**: sessionStorage is per-tab, so the tabs have independent drafts. The last tab to write wins on the server (via 30s `PATCH`). **Assumption**: acceptable for MVP; explicitly call this out in the `case-form-draft` spec as a known limitation. **Alternative**: broadcast via `BroadcastChannel` API to sync drafts across tabs — extra surface area, defer.
