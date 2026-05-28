# Tasks: Backend Integration

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Est. changed lines | ~2,800 across 7 PRs |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2 → PR 3 → PR 4 → PR 5 → PR 6 → PR 7 |
| Delivery strategy | force-chained PRs (stacked-to-main) |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Work Units

| # | PR | Scope | Est. |
|---|-----|-------|------|
| 1 | PR 1 | Migration + 4 repositories + repo specs | ~800 |
| 2 | PR 2 | Documents module (POST /upload) | ~360 |
| 3 | PR 3 | Analysis module (GET /:id + /:id/status) | ~440 |
| 4 | PR 4 | Review module (POST /:docId/entities/:entityId) | ~300 |
| 5 | PR 5 | Templates module (GET + POST) | ~370 |
| 6 | PR 6 | Frontend wiring (rewrites, global prefix, CORS) | ~50 |
| 7 | PR 7 | E2E test fixes (10 failing Playwright tests) | ~300 |

## PR 1: Migration + Repositories

- [x] 1.1 **T** repo specs: documents, analysis-results, entities, templates
- [x] 1.2 Create `0002_document_templates.sql` (4 tables, indexes, RLS)
- [x] 1.3 Create `documents.repository.ts` (CRUD by userId)
- [x] 1.4 Create `analysis-results.repository.ts` (CRUD + progress update)
- [x] 1.5 Create `entities.repository.ts` (CRUD + bulk insert)
- [x] 1.6 Create `templates.repository.ts` (CRUD + name uniqueness)
- [x] 1.7 **I** integration test: new table RLS isolation

## PR 2: Documents Module

- [x] 2.1 **T** docs controller spec (POST /upload contract)
- [x] 2.2 **T** docs service spec (multipart → INSERT doc + analysis_result)
- [x] 2.3 Create `documents.module.ts`
- [x] 2.4 Create `documents.service.ts` (metadata extract, DB insert)
- [x] 2.5 Create `documents.controller.ts` (POST /upload, FileInterceptor)
- [x] 2.6 Add `@types/multer` to package.json
- [x] 2.7 **I** supertest: upload returns Document shape

## PR 3: Analysis Module

- [x] 3.1 **T** analysis controller spec (GET /:id + /:id/status)
- [x] 3.2 **T** analysis service spec (~25/poll progression, entity INSERT at 100%)
- [x] 3.3 Create `analysis.module.ts`
- [x] 3.4 Create `analysis.service.ts` (DB-backed poll, seed entities on complete)
- [x] 3.5 Create `analysis.controller.ts` (/:id full result, /:id/status lightweight)
- [x] 3.6 **I** supertest: poll cycle upload → completed + entities

## PR 4: Review Module

- [x] 4.1 **T** review controller spec (POST /:docId/entities/:entityId)
- [x] 4.2 **T** review service spec (UPDATE entity row, 404 on missing)
- [x] 4.3 Create `review.module.ts`
- [x] 4.4 Create `review.service.ts` (entity UPDATE by ID)
- [x] 4.5 Create `review.controller.ts` (POST /:documentId/entities/:entityId)
- [x] 4.6 **I** supertest: review updates entity fields

## PR 5: Templates Module

- [x] 5.1 **T** templates controller spec (GET + POST, validation errors)
- [x] 5.2 **T** templates service spec (CRUD, 409 on duplicate name)
- [x] 5.3 Create `templates.module.ts`
- [x] 5.4 Create `templates.service.ts` (list, create with JSONB entities snapshot)
- [x] 5.5 Create `templates.controller.ts` (GET / + POST /, Zod parse)
- [x] 5.6 **I** supertest: list + create template, 400 + 409 errors

## PR 6: Frontend Wiring

- [x] 6.1 Add `app.setGlobalPrefix('api')` + CORS (origin from env) to main.ts
- [x] 6.2 Import DocumentsModule, AnalysisModule, ReviewModule, TemplatesModule in app.module.ts
- [x] 6.3 Add `CORS_ORIGIN` to env.ts config parser
- [x] 6.4 Add Next.js rewrites proxy in next.config.ts (`/api/:path*` → `API_BASE_URL`)
- [x] 6.5 Set `NEXT_PUBLIC_MSW=false` in apps/web/.env.local
- [x] 6.6 Verify all 45 existing tests remain green

## PR 7: E2E Test Fixes

- [ ] 7.1 Diagnose 10 failing Playwright E2E tests
- [ ] 7.2 Fix selector issues (likely MSW→real API timing, selector staleness)
- [ ] 7.3 Verify full E2E suite green
