# Merge Plan — 5 features → main

**Date**: 2026-07-05
**Base**: `feature/new-case-flow-tracker` @ `13d39d1`
**Target**: `main`
**Strategy**: Sequential merge into integration branch → test → single PR to main

---

## Branches to merge

| # | Branch | Worktree | Commits |
|---|--------|----------|---------|
| 1 | `fix/regenerate-doc-error` | `template-ai-regenerate-doc` | 6 |
| 2 | `fix/multi-doc-generation` | `template-ai-multi-doc` | 7 |
| 3 | `feature/delete-docs` | `template-ai-delete-docs` | 3 |
| 4 | `feature/templates-and-docs-name-changing` | `template-ai-templates-docs` | 8 |
| 5 | `feature/session-storage-form-data` | `template-ai-session-storage` | 6 |

---

## Merge Order & Conflict Resolution

### Step 1: Merge `fix/regenerate-doc-error`

```bash
cd /home/ferenoch/Projects/mis_proyectos/template-ai
git checkout feature/new-case-flow-tracker
git merge fix/regenerate-doc-error --no-ff
```

**Files changed**: `apps/api/src/ai/`, `apps/api/src/cases/cases.service.ts`, `apps/api/src/infrastructure/http/exception.filter.ts`, `apps/web/src/app/preview/`, `apps/web/src/lib/api/cases.ts`

**Expected conflicts**: None (first merge, clean base)

**Verify**: `pnpm --filter @template-ai/api test && pnpm --filter @template-ai/web test`

---

### Step 2: Merge `fix/multi-doc-generation`

```bash
git merge fix/multi-doc-generation --no-ff
```

**Expected conflicts**:

| File | Conflict | Resolution |
|------|----------|------------|
| `apps/api/src/cases/cases.service.ts` | Both add new methods (regenerate adds `generate` changes, multi-doc adds idempotent `create`) | Keep both — they're in different methods. Accept both sides. |
| `apps/web/src/app/preview/[caseId]/page.tsx` | Both modify preview page (regenerate adds retry UX, multi-doc adds `regenerateInFlight` ref) | Keep both. Merge the `handleRegenerate` from regenerate-doc with the ref guard from multi-doc. |
| `apps/web/src/lib/api/cases.ts` | Both extend the API client (regenerate adds `errorType` + `parseErrorResponse`, multi-doc adds `signal` param) | Keep both. Merge `ApiError` fields, merge function signatures. |
| `apps/api/src/infrastructure/postgres/migrations/0011_*.sql` | Migration numbering collision | Rename multi-doc migration to `0012_one_borrador_per_user_template.sql` |

**Verify**: `pnpm --filter @template-ai/api test && pnpm --filter @template-ai/web test`

---

### Step 3: Merge `feature/delete-docs`

```bash
git merge feature/delete-docs --no-ff
```

**Expected conflicts**:

| File | Conflict | Resolution |
|------|----------|------------|
| `apps/api/src/cases/cases.controller.ts` | Both modify controller (multi-doc adds 201/200 + @Res, delete-docs adds @HttpCode(204)) | Keep both — different methods. Verify `archive()` has `@HttpCode(204)` and `create()` has `res.status()`. |

**Verify**: `pnpm --filter @template-ai/api test && pnpm --filter @template-ai/web test`

---

### Step 4: Merge `feature/templates-and-docs-name-changing`

```bash
git merge feature/templates-and-docs-name-changing --no-ff
```

**Expected conflicts**:

| File | Conflict | Resolution |
|------|----------|------------|
| `apps/api/src/cases/cases.service.ts` | templates-docs adds `updateName`, previous merges added `generate` changes + idempotent `create` | Different methods — accept both. |
| `apps/api/src/cases/cases.controller.ts` | templates-docs adds PATCH name routing | Keep all. Ensure the new PATCH logic doesn't interfere with DELETE 204 or POST 201/200. |
| `apps/api/src/infrastructure/postgres/repositories/cases.repository.ts` | templates-docs adds `updateName` + `CASE_SELECT` changes, multi-doc added `findBorradorByUserAndTemplate` | Keep both. Merge SELECT constants. |
| `apps/web/src/app/biblioteca/page.tsx` | Both modify biblioteca page (delete-docs adds `handleDeleteCase`, templates-docs adds `handleRename`) | Keep both — different handlers. Merge imports. |
| `apps/web/src/components/biblioteca/CaseList.tsx` | Both modify (delete-docs adds delete UX, templates-docs adds EditableName) | **Manual merge needed**. Keep delete props + state, add EditableName wrapper. |
| `apps/web/src/components/biblioteca/TemplateCard.tsx` | Both modify (delete-docs changes `templateName→itemName`, templates-docs adds EditableName) | Keep both. Ensure `itemName` prop rename is preserved and EditableName wraps the `<h3>`. |
| `packages/contracts/src/schemas.ts` | templates-docs modifies `CaseSchema` + adds `UpdateTemplateNameSchema` | Keep all. Merge schema changes. |
| `apps/api/src/infrastructure/postgres/migrations/` | Numbering collision: templates-docs has `0011_casos_name.sql`, `0012_casos_name_unique.sql` | Rename to `0013_casos_name.sql` and `0014_casos_name_unique.sql` |

**Verify**: `pnpm --filter @template-ai/api test && pnpm --filter @template-ai/web test && pnpm --filter @template-ai/contracts test`

---

### Step 5: Merge `feature/session-storage-form-data`

```bash
git merge feature/session-storage-form-data --no-ff
```

**Expected conflicts**:

| File | Conflict | Resolution |
|------|----------|------------|
| `apps/web/src/app/nuevo/[templateId]/page.tsx` | Both modify (multi-doc adds AbortController + refs, session-storage adds `clearDraft` calls) | Keep both. Merge `clearDraft()` calls alongside AbortController logic. |
| `packages/contracts/src/schemas.ts` | session-storage adds `CaseFormDraftSchema`, templates-docs already modified `CaseSchema` | Keep both — schemas are adjacent, not overlapping. |
| `packages/contracts/src/index.ts` | Both add re-exports | Keep both re-exports. |
| `apps/api/src/infrastructure/postgres/migrations/` | Numbering collision: session-storage has `0011_borrador_unique.sql` | Rename to `0015_borrador_unique.sql` |

**Verify**: `pnpm --filter @template-ai/api test && pnpm --filter @template-ai/web test && pnpm --filter @template-ai/contracts test`

---

## Final Verification (after all merges)

```bash
# Full test suite
pnpm --filter @template-ai/api test
pnpm --filter @template-ai/web test
pnpm --filter @template-ai/contracts test

# Typecheck + lint
pnpm typecheck
pnpm lint

# Build check
pnpm --filter @template-ai/api build
pnpm --filter @template-ai/web build

# Migration numbering check (must be sequential: 0011 → 0012 → 0013 → 0014 → 0015)
ls apps/api/src/infrastructure/postgres/migrations/ | sort
```

---

## Migration Numbering — Final State

| Number | File | Source branch |
|--------|------|---------------|
| 0011 | `0011_casos_name.sql` | templates-docs (renamed from original 0011) |
| 0012 | `0012_one_borrador_per_user_template.sql` | multi-doc (renamed from 0011) |
| 0013 | `0013_casos_name_unique.sql` | templates-docs (renamed from 0012) |
| 0014 | `0014_borrador_unique.sql` | session-storage (renamed from 0011) |
| ... | (pre-existing) | — |

> **Note**: The agent must check existing migrations in `feature/new-case-flow-tracker` before renumbering. Adjust numbering if pre-existing migrations occupy these slots.

---

## Git commands summary (for the agent)

```bash
# 1. Start from clean integration branch
cd /home/ferenoch/Projects/mis_proyectos/template-ai
git checkout feature/new-case-flow-tracker
git pull origin feature/new-case-flow-tracker  # if remote exists

# 2. Merge in order, resolving conflicts at each step
for branch in \
  fix/regenerate-doc-error \
  fix/multi-doc-generation \
  feature/delete-docs \
  feature/templates-and-docs-name-changing \
  feature/session-storage-form-data
do
  git merge $branch --no-ff -m "merge: integrate $branch into new-case-flow-tracker"
  # Resolve conflicts → git add → git commit
  pnpm --filter @template-ai/api test && pnpm --filter @template-ai/web test || exit 1
done

# 3. Final verification
pnpm typecheck && pnpm lint

# 4. Push integration branch
git push origin feature/new-case-flow-tracker

# 5. Create PR to main
gh pr create \
  --base main \
  --head feature/new-case-flow-tracker \
  --title "feat: integrate 5 features (session-storage, rename, delete, multi-doc fix, regenerate fix)" \
  --body "$(cat .atl/merge-plan-2026-07-05.md)"
```

---

## Rollback

If any merge step fails tests after conflict resolution, stop and report which branch + which file failed. Do NOT force-continue. Each step must be green before proceeding to the next.
