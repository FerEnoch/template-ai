# Proposal: Client Wizard Flow

## Intent

The 4 existing screens (upload, analysis, review, save) are static shells with hardcoded data. Users cannot navigate between steps, upload real files, or persist draft state. This change wires them into a connected wizard with shared state, client-side interactions, and a mock API layer — making the flow demonstrable end-to-end before backend integration.

## Scope

### In Scope
- Wizard state machine (React Context + useReducer) with step validation gating
- Functional drag & drop on upload with Zod-based file validation
- Mock API layer (MSW) with realistic handlers for upload, analysis polling, entity review, template save
- Shared Zod contracts (`packages/contracts`) for Document, AnalysisResult, Entity, Template
- Skeleton→content transitions on analysis, expand/collapse entity groups on review
- Form validation (react-hook-form + Zod) on save step
- Next.js App Router navigation with state preserved via URL search params + Context
- localStorage draft persistence

### Out of Scope
- Real backend integration, authentication, file persistence
- Mobile responsive (desktop-first)
- Error boundary infrastructure (basic error states only)
- e2e / integration tests at this stage

## Capabilities

### New Capabilities
- `client-wizard-flow`: Multi-step wizard with sequential validation, back/forward navigation, and draft persistence
- `shared-contracts`: Zod schemas shared between frontend and future backend via `packages/contracts`
- `mock-service-layer`: MSW request handlers simulating backend with realistic test data and latency

### Modified Capabilities
- `workspace-foundation`: Add `packages/contracts` to workspace scope (originally restricted to `apps/*`)

## Approach

- **Wizard state**: `useReducer` + React Context. Steps: upload → analysis → review → save. Each step validates before `nextStep()` commits. URL search params (`?step=2`) mirror state for refresh safety.
- **Contracts**: `packages/contracts` as a workspace package with Zod schemas. No runtime deps — pure types.
- **Mock layer**: MSW in `apps/web/src/mocks/`. Handlers simulate upload (0→100% over 2s), analysis polling (3–5s with progressive entity reveal), save (200ms success). Test data in `mocks/data/`.
- **Interactions**: Native HTML5 DnD API on upload dropzone. `react-hook-form` with `@hookform/resolvers/zod` on save form. CSS transitions for skeleton→content.
- **Draft**: `localStorage` keyed by `template-draft:v1`. Reset on save success or explicit cancel.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `packages/contracts/` | **New** | Zod schemas for Document, AnalysisResult, Entity, Template |
| `apps/web/src/context/` | **New** | WizardProvider, useWizard hook, reducer |
| `apps/web/src/mocks/` | **New** | MSW handlers, test data |
| `apps/web/src/app/upload/` | Modified | DnD, validation, file state, navigation |
| `apps/web/src/app/analysis/` | Modified | Polling, skeleton→content, progress |
| `apps/web/src/app/review/` | Modified | Entity inspector toggles, confidence filter |
| `apps/web/src/app/save/` | Modified | Form validation, submit, success state |
| `pnpm-workspace.yaml` | Modified | Add `packages/*` glob |
| Root `package.json` | Modified | Add MSW, react-hook-form, zod deps |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| MSW intercepts dev requests after mocking is removed | Low | Conditional `enable()` only in mock mode; clear env toggle |
| Context+URL state divergence on browser back | Medium | `useWizard` syncs URL params on every step change; Effect on mount reads from URL first |
| Draft corruption on schema evolution | Low | Version key in localStorage (`template-draft:v1`); clear on mismatch |

## Rollback Plan

1. Remove `packages/contracts` workspace reference from `pnpm-workspace.yaml`
2. Delete `packages/contracts/`, `apps/web/src/context/`, `apps/web/src/mocks/`
3. Restore each page to its static `export default` shell (git revert)
4. Remove MSW, react-hook-form, zod from deps

## Dependencies

- Existing 4 static screens as visual foundations
- `packages/contracts` must not block backend work — schemas are the single source of truth

## Success Criteria

- [ ] User can upload a file via drag & drop; validation rejects invalid types/sizes
- [ ] Upload triggers animated progress, then navigates to analysis
- [ ] Analysis screen polls mock API and renders entity previews after 3–5s
- [ ] Review screen shows expandable entity groups with confidence badges
- [ ] Save form validates required fields, submits to mock, shows success
- [ ] Browser refresh preserves current step and draft data
- [ ] Back/forward navigation respects step validation gates
