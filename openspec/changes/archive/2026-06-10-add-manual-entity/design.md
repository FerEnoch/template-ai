# Design: Add Manual Entity Creation

## Technical Approach

Extend the existing AI extraction pipeline with a narrow single-span classification prompt. Frontend captures `window.getSelection()` against the document preview, sends the span + context to a new backend endpoint, receives AI-inferred `{ label, group, value }`, and opens a create modal for user confirmation. A 5-entity-per-document cap is enforced server-side (source of truth) and optimistically client-side.

Two new API endpoints: `POST /api/review/:resultId/entities/classify-span` (AI classification) and `POST /api/review/:resultId/entities` (persist confirmed entity). Both gated by manual entity count check.

## Architecture Decisions

| # | Decision | Options | Choice | Rationale |
|---|----------|---------|--------|-----------|
| 1 | Text selection mechanism | (A) `window.getSelection()` + Range API text-node traversal (B) Pointer events with char counting | **A** | Range API gives exact text-node offsets; pointer events are fragile with `<mark>` elements. Traversal computes absolute offsets in `extractedText` string. Handles multi-byte (Spanish accents) because JS string indices are UTF-16 code units, matching `String.slice`. |
| 2 | Selection mode state location | (A) Local `useState` in `review/page.tsx` (B) Global wizard reducer | **A** | Selection mode is ephemeral UI state — doesn't belong in persisted wizard state. Keeps reducer clean. Cleared on navigation automatically. |
| 3 | AI classification prompt | (A) New `classifySpan()` method with narrow prompt (B) Reuse `extractEntities()` with single-span text | **A** | Narrow prompt is faster (~1-2s vs 3-5s), cheaper (150 max_tokens vs 8192), and deterministic (temperature 0). Separate method isolates failure modes. |
| 4 | EntityCreateModal approach | (A) Extend `EntityEditModal` with `mode` prop (B) Separate `EntityCreateModal` component | **A** | Spec requires reuse of dialog pattern. Extension avoids duplicating dialog chrome, backdrop handling, escape-key logic. Conditional logic is limited to: label editable/readonly, confidence toggle disabled, group dropdown visible. |
| 5 | Manual entity tracking | (A) `userCreated: boolean` column on entities table (B) Infer from absence in analysis result (C) Separate tracking table | **A** | Server must count manual entities for cap enforcement. Inference (B) is fragile — requires loading full analysis result for every count check. A boolean column makes `COUNT(*) WHERE user_created = true` trivial. Minimal schema change. |
| 6 | Entity ID generation | (A) `crypto.randomUUID()` client-side (B) Server-generated UUID | **A** | Consistent with existing pattern — wizard state entities already have client-side IDs. Enables optimistic UI update before server persistence. Server validates UUID format on persist. |
| 7 | Error recovery strategy | (A) Auto-retry once + manual fallback (B) Immediate manual fallback (C) Block on error | **A** | AI timeouts are transient — one retry covers most cases. Malformed JSON fallback lets user proceed without blocking. Never trap the user. |

## Data Flow

### Happy Path

```
User clicks "+ AGREGAR CAMPO"
  │
  ▼
review/page.tsx: setSelectionMode(true) → cursor: crosshair on <article>
  │
  ▼
User selects text in preview → mouseup listener fires
  │
  ▼
computeSelectionOffsets(articleEl, extractedText) → { text, sourceSpan, context }
  │
  ▼
POST /api/review/:resultId/entities/classify-span
  │
  ├─ ReviewService.classifySpan()
  │    ├─ countManualEntities(documentId) → check < MANUAL_ENTITY_LIMIT
  │    ├─ OpenRouterService.classifySpan(text, context) → { label, group, value }
  │    └─ Return ClassifySpanResponse
  │
  ▼
EntityEditModal opens with mode="create", pre-filled fields
  │
  ▼
User adjusts label/group/value → clicks "Agregar"
  │
  ├─ dispatch ADD_ENTITY → wizard state updated (optimistic)
  ├─ POST /api/review/:resultId/entities → server persists
  └─ Entity appears in inspector with "Con traza" badge
```

### Error Path (AI Timeout)

```
POST classify-span → 10s timeout
  │
  ├─ Auto-retry once (transparent)
  │    ├─ Success → continue happy path
  │    └─ Timeout again → show error state
  │         ├─ "Reintentar" button → manual retry
  │         └─ "Agregar manualmente" → open modal with empty label/group
```

## Interfaces / Contracts

### New Zod Schemas (`@template-ai/contracts`)

```typescript
export const ClassifySpanRequest = z.object({
  text: z.string().min(1),
  sourceSpan: z.object({
    start: z.number().int().min(0),
    end: z.number().int().min(1),
  }),
  context: z.string(),
});

export const ClassifySpanResponse = z.object({
  label: z.string().min(1),
  group: z.enum(["PARTES", "INMUEBLE", "FECHAS", "ANEXOS"]),
  value: z.string(),
});

export const MANUAL_ENTITY_LIMIT = 5;
```

### Entity Schema Extension

```typescript
// Add to EntitySchema:
userCreated: z.boolean().default(false),
```

### API Endpoints

**POST `/api/review/:resultId/entities/classify-span`**

```typescript
// Request body: ClassifySpanRequest
// Response 200: { entity: Entity }  (fully formed, confidence=ALTA, sourceSpan populated)
// Response 403: { error: string, code: "MANUAL_ENTITY_LIMIT_REACHED" }
// Response 408: { error: string, code: "AI_TIMEOUT" }
// Response 422: { error: string, code: "CLASSIFICATION_FAILED" }
```

**POST `/api/review/:resultId/entities`**

```typescript
// Request body: Entity (without id — server assigns or validates client-provided id)
// Response 201: { entity: ReviewEntity }
// Response 403: { error: string, code: "MANUAL_ENTITY_LIMIT_REACHED" }
```

### EntityEditModal Extension

```typescript
interface EntityEditModalProps {
  entity: Entity | null;
  isOpen: boolean;
  mode?: "edit" | "create";        // NEW: defaults to "edit"
  onSave: (entity: Entity) => Promise<void> | void;
  onClose: () => void;
}
// mode="create": label editable, group dropdown visible,
//   confidence locked ALTA (disabled toggle), button text "Agregar"
// mode="edit": existing behavior (label read-only, confidence toggleable)
```

### WizardAction Extension

```typescript
// Add to WizardAction union:
| { type: "ADD_ENTITY"; entity: Entity }
```

### WizardContext Extension

```typescript
// Add to WizardContextValue:
addEntity: (entity: Entity) => void;
```

## Text Selection Hook

A `useTextSelection` hook (inline in `review/page.tsx`, extracted if reused):

```typescript
function useTextSelection(articleRef: RefObject<HTMLElement>, extractedText: string | null) {
  // Returns: { selection: { text, sourceSpan, context } | null, clearSelection }
  // On mouseup inside articleRef:
  //   1. Get window.getSelection()
  //   2. Walk text nodes inside articleRef to compute absolute char offset
  //   3. Extract ±100 chars context from extractedText
  //   4. Return { text, sourceSpan: { start, end }, context }
}
```

**Offset computation algorithm**: Walk all text nodes inside `<article>` in document order, accumulating character count. When `Range.startContainer` / `Range.endContainer` match a text node, add accumulated count + `Range.startOffset` / `Range.endOffset`. This produces offsets into the concatenated text content, which must match `extractedText`.

## File Changes

### PR1: Backend (~380 lines)

| File | Action | Description |
|------|--------|-------------|
| `packages/contracts/src/schemas.ts` | Modify | Add `ClassifySpanRequest`, `ClassifySpanResponse`, `MANUAL_ENTITY_LIMIT`, `userCreated` to EntitySchema |
| `packages/contracts/src/index.ts` | Modify | Export new schemas and constant |
| `packages/contracts/src/schemas.test.ts` | Modify | Tests for new Zod schemas |
| `apps/api/src/ai/open-router.service.ts` | Modify | Add `classifySpan(text, context)` method with narrow prompt |
| `apps/api/src/ai/open-router.service.spec.ts` | Create | Unit tests for classifySpan prompt and response parsing |
| `apps/api/src/review/review.service.ts` | Modify | Add `classifySpan()`, `createEntity()`, `countManualEntities()` |
| `apps/api/src/review/review.service.spec.ts` | Modify | Tests for new service methods |
| `apps/api/src/review/review.controller.ts` | Modify | Add `classifySpan` and `createEntity` endpoints |
| `apps/api/src/review/review.controller.spec.ts` | Modify | Tests for new controller methods |
| `apps/api/src/review/review.controller.integration.spec.ts` | Modify | Integration tests for new endpoints |
| `apps/api/src/review/review.module.ts` | Modify | Import `AiModule` for `OpenRouterService` |
| `apps/api/src/infrastructure/postgres/repositories/entities.repository.ts` | Modify | Add `userCreated` to `CreateEntityInput`, add `countUserCreated()` |
| DB migration | Create | Add `user_created BOOLEAN NOT NULL DEFAULT false` to entities table |

### PR2: Frontend (~370 lines)

| File | Action | Description |
|------|--------|-------------|
| `apps/web/src/lib/wizard/types.ts` | Modify | Add `ADD_ENTITY` to `WizardAction` union |
| `apps/web/src/lib/wizard/wizardReducer.ts` | Modify | Handle `ADD_ENTITY` case |
| `apps/web/src/lib/wizard/wizardReducer.test.ts` | Modify | Tests for `ADD_ENTITY` |
| `apps/web/src/lib/wizard/WizardContext.tsx` | Modify | Add `addEntity()` method |
| `apps/web/src/components/wizard/EntityEditModal.tsx` | Modify | Add `mode` prop, editable label, group dropdown |
| `apps/web/src/components/wizard/EntityEditModal.test.tsx` | Modify | Tests for create mode |
| `apps/web/src/components/wizard/EntityInspector.tsx` | Modify | Add "+ AGREGAR CAMPO" button in group headers and empty states |
| `apps/web/src/app/review/page.tsx` | Modify | Text selection mode, classify handler, modal integration |
| `apps/web/src/mocks/handlers.ts` | Modify | MSW handlers for classify-span and create-entity |
| E2E test | Create | Full selection → classification → confirmation flow |

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | `ClassifySpanRequest`/`ClassifySpanResponse` Zod schemas | Valid/invalid inputs, edge cases (empty text, negative offsets) |
| Unit | `wizardReducer` ADD_ENTITY | Appends entity, preserves existing entities |
| Unit | `OpenRouterService.classifySpan()` | Mock OpenAI client, verify prompt structure, temperature=0, max_tokens=150 |
| Unit | `EntityEditModal` mode="create" | Label editable, group dropdown visible, confidence locked ALTA |
| Integration | `ReviewController` classify-span | Mock service, verify request validation, error codes |
| Integration | `ReviewService.classifySpan()` | Mock OpenRouter + repository, verify cap check + AI call |
| Integration | `ReviewService.createEntity()` | Mock repository, verify cap check + persist |
| E2E | Full flow | Playwright: select text → classify → confirm → entity visible in inspector |

## Migration / Rollout

- **DB migration**: Add `user_created BOOLEAN NOT NULL DEFAULT false` column to `entities` table. Non-breaking — all existing rows get `false`.
- **Feature flag**: `manualEntityCreation.enabled` (env var). When `false`, new endpoints return 404. Both PRs independently revertable.
- **No data migration needed**: Existing entities are AI-generated, default `user_created = false` is correct.

## Open Questions

- [ ] Should the `classify-span` endpoint also persist the entity, or should persistence be a separate `POST /entities` call? Current design: two-step (classify → confirm → persist) to let user adjust before committing.
- [ ] Should the group dropdown in create mode include all 4 groups or be pre-filtered by AI suggestion? Current design: all 4 groups available, AI suggestion pre-selected.
