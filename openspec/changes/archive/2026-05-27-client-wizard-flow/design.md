# Design: Client Wizard Flow

## Technical Approach

Wire the 4 static screens into a sequential wizard with shared state, mock API, and draft persistence. Keep Next.js App Router pages as separate routes. Use React Context + useReducer for wizard state, MSW for mock backend, and a new `packages/contracts` workspace package for shared Zod schemas.

## Architecture Decisions

| Decision | Options | Tradeoffs | Choice |
|----------|---------|-----------|--------|
| Wizard state | Context+useReducer / Zustand / XState | Context fits 4 linear steps without extra deps; Zustand adds ~1KB but simpler for future scaling; XState overkill for linear flow | **Context + useReducer** — migrate to Zustand if steps grow beyond 6 or branching appears |
| Step gating | Layout redirect / Page guard / Middleware | Layout redirect is colocated with state; Middleware can't read React Context easily | **Page-level redirect** in each step component: reads context, redirects to earliest uncompleted step |
| Route model | Separate routes (`/upload`…) / Single route (`/wizard?step=`) | Separate routes preserve existing files and deep-linking; single route needs more rewrite | **Keep `/upload`, `/analysis`, `/review`, `/save`** with `?step=` synced to context for refresh safety |
| Mock API | MSW / Custom fetch wrapper / Inline mocks | MSW intercepts real fetch, easy to remove later; custom wrapper leaks abstraction | **MSW browser-only**, enabled via `NEXT_PUBLIC_MSW=true` |
| Contracts build | tsc-only / tsup / unbuild | tsc-only is zero-config for pure types; tsup faster but unnecessary | **tsc-only** — `packages/contracts` emits `.d.ts` + `.js`, no bundler |
| File DnD | Native HTML5 / react-dropzone | Native API avoids dependency; react-dropzone adds a11y and mobile polish we don't need (desktop-first) | **Native HTML5 DnD** with manual validation |
| Form validation | react-hook-form+Zod / manual | RHF reduces boilerplate for save form; manual is fine for 2 fields but doesn't scale | **react-hook-form + Zod** on save step only |

## Data Flow

```
UploadPage (DnD + file validation)
    │ file accepted
    ▼
WizardContext ──► localStorage (draft:v1)
    │
    ▼
/analysis?step=2 ──► mock /api/analyze (progress 0→100%)
    │ polling every 800ms
    ▼
AnalysisPage ──► skeleton→content transition
    │ analysisResult set in context
    ▼
/review?step=3 ──► EntityInspector (expand/collapse, edits)
    │ user confirms
    ▼
/save?step=4 ──► react-hook-form + Zod
    │ submit → mock /api/templates
    ▼
WizardContext.reset() + localStorage.removeItem()
```

Shared state in `WizardContext`: `file`, `analysisResult`, `entities`, `templateForm`. Step-local state: `uploadProgress`, `pollingStatus`, `expandedGroups`.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `packages/contracts/package.json` | Create | Workspace package: Zod + TypeScript |
| `packages/contracts/src/schemas.ts` | Create | `DocumentSchema`, `AnalysisResultSchema`, `EntitySchema`, `TemplateSchema` |
| `packages/contracts/src/index.ts` | Create | Re-exports schemas + inferred types |
| `packages/contracts/tsconfig.json` | Create | `declaration: true`, `outDir: dist` |
| `apps/web/src/context/wizard-context.tsx` | Create | `WizardProvider`, reducer, `useWizard` hook |
| `apps/web/src/context/wizard-types.ts` | Create | State types, action union, step enum |
| `apps/web/src/components/wizard/wizard-layout.tsx` | Create | Syncs URL `?step=` with context; wraps page content |
| `apps/web/src/components/wizard/step-indicator.tsx` | Create | Visual stepper shared across 4 pages |
| `apps/web/src/components/upload/file-dropzone.tsx` | Create | Native DnD zone with Zod file validation |
| `apps/web/src/components/review/entity-inspector.tsx` | Create | Expandable entity groups with confidence badges |
| `apps/web/src/mocks/browser.ts` | Create | MSW `setupWorker` entry |
| `apps/web/src/mocks/handlers.ts` | Create | `POST /api/analyze`, `GET /api/analyze/:id`, `POST /api/templates` |
| `apps/web/src/mocks/data/analysis-result.ts` | Create | Realistic mock data for 11-field contract |
| `apps/web/src/lib/storage.ts` | Create | `loadDraft`, `saveDraft`, `clearDraft` with version check |
| `apps/web/src/app/upload/page.tsx` | Modify | Add `'use client'`, wire `FileDropzone`, navigation |
| `apps/web/src/app/analysis/page.tsx` | Modify | Add `'use client'`, polling logic, skeleton→content |
| `apps/web/src/app/review/page.tsx` | Modify | Add `'use client'`, `EntityInspector`, confirm action |
| `apps/web/src/app/save/page.tsx` | Modify | Add `'use client'`, `react-hook-form`, submit to mock |
| `apps/web/src/app/layout.tsx` | Modify | Conditionally init MSW worker in `useEffect` |
| `pnpm-workspace.yaml` | Modify | Add `packages/*` glob |
| `apps/web/package.json` | Modify | Add `msw`, `react-hook-form`, `@hookform/resolvers`, `zod` deps |

## Interfaces / Contracts

```ts
// packages/contracts/src/schemas.ts
export const DocumentSchema = z.object({
  name: z.string().min(1),
  size: z.number().max(25 * 1024 * 1024),
  type: z.enum(["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "image/jpeg"]),
});

export const EntitySchema = z.object({
  id: z.string().uuid(),
  label: z.string(),
  value: z.string(),
  confidence: z.enum(["ALTA", "BAJA"]),
  group: z.enum(["PARTES", "INMUEBLE", "FECHAS", "ANEXOS"]),
});

export const AnalysisResultSchema = z.object({
  jobId: z.string().uuid(),
  status: z.enum(["pending", "processing", "completed", "failed"]),
  progress: z.number().min(0).max(100),
  entities: z.array(EntitySchema),
});

export const TemplateSchema = z.object({
  name: z.string().min(3).max(120),
  description: z.string().max(500),
  category: z.string(),
  entities: z.array(EntitySchema),
});
```

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | Reducer state transitions | Vitest — pure function tests for each action |
| Unit | Zod schemas | Vitest — valid/invalid payload assertions |
| Integration | FileDropzone → context → navigation | React Testing Library — render with provider, simulate drop |
| Integration | MSW handlers | Vitest — call handlers directly, assert response shape |

## Migration / Rollout

No migration required. MSW is dev-only. Enable with `NEXT_PUBLIC_MSW=true pnpm dev:web`.

## Open Questions

- [ ] Should `packages/contracts` publish or stay workspace-private? (Workspace-private for now.)
- [ ] Should step indicator live in `AppShell` or per-page? (Per-page via `WizardLayout` to avoid making `AppShell` client-only.)
