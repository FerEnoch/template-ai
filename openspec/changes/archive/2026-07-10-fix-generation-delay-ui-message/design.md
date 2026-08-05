# Design: Fix Generation Delay UI Message

## Technical Approach

**Phase 1 (implement now)** — defensive config + error mapping, no new infra, no DB changes. Keep the synchronous `POST /cases/:id/generate` but let it survive real latency: raise the Next.js dev-proxy and NestJS request timeouts to 300s, add latency-aware Spanish 502/500 fallbacks, and rely on the existing `handleGenerate` catch-recovery (re-fetch case → if `generado`, treat as success) so a proxy drop after backend success is not shown as an error. Maps to `document-generation-ux` R1–R7 and the `local-operational-infra` Phase-1 exception.

**Phase 2 (design only, separate change)** — decouple via a queue. `POST /cases/:id/generate` returns `202` immediately, AI work runs in a BullMQ worker mirroring the established `async-analysis-worker`, the frontend polls `GET /cases/:id`, and the 300s timeout reverts to 30s. Maps to `async-document-generation` R1–R6.

## Architecture Decisions

| Decision | Options | Tradeoff | Choice + Rationale |
|---|---|---|---|
| P1 timeout value | 150s / 200s / **300s** / 600s | Tight = stuck-request blast radius; loose = safety | **300s**. Worst case = 3 attempts × ~48s + 1s/3s backoff ≈ 148s; 300s ≈ 2× headroom without reaching the OpenAI SDK 600s default. |
| Polling interval (P2) | 1s / **3–5s** / 10s | Fast = responsive but DB load; slow = cheap but laggy | **3s default, 5s ceiling.** ~48s typical → ~16 polls; cheap indexed RLS read, completion felt within 3s. Bounded by a 300s poll window → "still processing" state. |
| Proxy-502 vs backend-502 disambiguation | status only / **fetchCase re-check** | status alone is ambiguous (backend throws 502 on AI failure too) | **fetchCase status + body.** Backend AI-failure 502 carries JSON ("No se pudo contactar al servicio de IA…") and leaves status `borrador` → surfaced as error. Proxy-drop 502 carries HTML and leaves status `generado` → recovered as success. |
| P2 in-progress status name | `generating` (spec text) / **`generando`** | consistency vs spec wording | **`generando`** (Spanish) to match existing `borrador`/`generado`/`exportado`/`archivado`. The async spec's "generating" is the English UI-state term leaking in; reconcile during P2. |
| P2 terminal failure state | **`failed` status** / revert to `borrador` (task desc) | explicit state vs retry-friendly | **`failed` + new `generation_error` column** (per async spec, mirrors `async-analysis-worker`); re-generation allowed from `failed`. ⚠ Task description says revert-to-`borrador` — **OPEN CONFLICT.** |
| P1 sync long-timeout vs P2 async short-timeout | — | P1 keeps a stuck-socket risk for 300s; P2 eliminates it | Accept P1 as a documented band-aid (`TODO(Phase2)`); P2 removes the long endpoint so 30s is safe again. |
| P2 queue mechanism | new infra / **reuse `analysis-queue` pattern** | novelty vs consistency | **Mirror `async-analysis-worker`**: BullMQ queue, in-process worker, ≤2 concurrency, 3 retries w/ backoff, RLS via `withOwnerTransaction(userId)` with userId from the job payload. |

## Data Flow

**Phase 1 generation + recovery:**
```
Click "Generar" → saveForm() → POST /api/cases/:id/generate (≤300s)
   ├─ 200 Case{generado} → router.push(/preview/:id) ✓
   └─ error (502/500/conn) → catch: fetchCase(:id)
        ├─ status=generado  → router.push(/preview/:id) ✓ (proxy dropped post-success)
        ├─ status=archivado → router.push(/biblioteca)
        └─ else / 404       → setGenerationError(latency-aware msg), status=idle
```
**Phase 2 (future):** `POST /generate → 202 + Case{generando}` → worker runs AI → `generando→generado|failed` → client polls `GET /cases/:id` every 3s.

## File Changes

| File | Phase | Action | Description |
|---|---|---|---|
| `apps/web/next.config.ts` | 1 | Modify | Add `experimental: { proxyTimeout: 300_000 }` |
| `apps/web/src/lib/api/cases.ts` | 1 | Modify | Add 502 + 500 cases to `fallbackMessageForStatus`. `parseErrorResponse` already falls back to status-msg for 5xx non-JSON bodies (R3 already satisfied) — optional explicit `status>=500` short-circuit guard. |
| `apps/web/src/components/case/CaseStickyBar.tsx` | 1 | Modify | Spinner msg → "Generando documento... Esto puede tomar hasta 2 minutos." Error prop already rendered verbatim (R5 done). |
| `apps/web/src/app/nuevo/[templateId]/page.tsx` | 1 | Verify | R4 catch-recovery ALREADY implemented (fetchCase→generado/archivado/else). Optional: `clearDraft(caseId)` on recovery path for parity with the happy path. |
| `apps/api/src/main.ts` | 1 | Modify | `REQUEST_TIMEOUT_MS` 120s→300s (current 120s is an undocumented prior band-aid for the same ECONNRESET); add `TODO(Phase2)` naming `async-document-generation`. |
| `packages/contracts/src/schemas.ts` | 2 | Modify | Add `generando` (+ `failed`) to `CaseStatus`. |
| `apps/api/src/cases/cases.controller.ts` | 2 | Modify | `POST :id/generate` → 202; validate `borrador`; idempotent on `generando`. |
| `apps/api/src/cases/cases.service.ts` | 2 | Modify | `generate` → `enqueueGeneration`: `borrador→generando`, enqueue, return; worker reuses existing `DocumentGenerationService`. |
| `apps/api/src/cases/generation-queue/*` | 2 | Create | Queue + worker mirroring `analysis-queue`. |
| `apps/api/src/main.ts` | 2 | Modify | Revert to 30s, remove `TODO(Phase2)`. |
| DB migration | 2 | Create | Allow `generando`/`failed` status; add `generation_error TEXT NULL`. |

## Interfaces / Contracts

Phase 1 — fallback messages (Spanish, latency-aware):
```ts
case 502: "El servidor está procesando tu solicitud. Esto puede tardar hasta 2 minutos. Aguardá y volvé a intentarlo."
case 500: "Ocurrió un error interno en el servidor. Intentá nuevamente en unos momentos."
```
Phase 2 — `POST /cases/:id/generate` → `202 Accepted` + `Case` body (`status: "generando"`); `GET /cases/:id` unchanged (poll target).

## Testing Strategy

| Layer | What | Approach (strict TDD: tests first) |
|---|---|---|
| Unit (web) | `fallbackMessageForStatus(502/500)`, `parseErrorResponse` on HTML 502 / empty 500 | Vitest — assert non-default Spanish msg, no throw |
| Unit (web) | `handleGenerate` catch → fetchCase generado/archivado/borrador | Vitest mock fetchCase + router |
| Unit (api) | `REQUEST_TIMEOUT_MS` = 300s + `TODO(Phase2)` comment | Static assert |
| E2E | Forced 502 → friendly msg; success after ~48s | Playwright |

## Migration / Rollout

Phase 1: none — config/code only, clean revert. Phase 2: status-enum + `generation_error` migration (additive; `failed` cases recoverable via re-generation).

## Open Questions

- [ ] **Spec conflict**: async spec says `failed` status; task description says revert-to-`borrador`. Spec owner to decide. (Design recommends `failed`.)
- [ ] Terminology: confirm `generando` over the spec's `generating` for enum consistency.
- [ ] Phase-2 navigate-away: returning to `/nuevo/[templateId]` while a `generando` case exists — bootstrap must find it (current `findBorradorByUserAndTemplate` only matches `borrador`) and resume the spinner instead of creating a new borrador.
