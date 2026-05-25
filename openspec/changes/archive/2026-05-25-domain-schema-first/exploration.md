## Exploration: domain-schema-first

### Current State
The MVP domain model and schema draft are already unusually close to implementation-ready. The conceptual model freezes ownership, retention, RLS, and fixed consumption rules; the PostgreSQL draft narrows this into a normalized schema with explicit tables, indexes, and invariants. The NestJS API bootstrap is intentionally still technical-only: env validation, `/health`, `/ready`, and PostgreSQL connectivity only—no repositories, migrations, or business modules yet.

### Affected Areas
- `docs/domain-conceptual-model.md` — defines the frozen ownership, retention, and tracing rules the first slice must honor.
- `docs/postgresql-schema-draft.md` — already lists the intended tables and should drive implementation order.
- `docs/stack-technological-adr.md` — confirms PostgreSQL as the source of truth and NestJS as the backend.
- `apps/api/src/main.ts` — bootstrap boundary; should remain technical while schema work starts.
- `apps/api/src/infrastructure/postgres/postgres.service.ts` — current DB wiring is readiness-only and needs to stay minimal.
- `openspec/specs/app-bootstrap-runtime/spec.md` — explicitly forbids repositories/migrations in bootstrap scope.

### Approaches
1. **Identity + usage foundation first** — implement `users`, `subscriptions`, and `usage_ledger` as the first persistence slice.
   - Pros: smallest valuable slice; unlocks ownership, access gating, and auditable consumption; aligns with frozen MVP decisions.
   - Cons: doesn’t yet persist document analysis or templates.
   - Effort: Low

2. **Ingest and analyze first** — start with `source_documents`, `document_analysis_jobs`, and `analysis_results`.
   - Pros: closer to the visible product flow.
   - Cons: too much surface area; depends on identity/usage already existing; pulls in provider abstraction earlier.
   - Effort: Medium

3. **Template library first** — start with `templates`, `template_fields`, `template_entities`, and traces.
   - Pros: models the core legal value proposition.
   - Cons: requires upstream analysis and ownership contracts; risks over-scoping before the persistence spine exists.
   - Effort: Medium

### Recommendation
Start with **Approach 1: identity + usage foundation**.

Minimum valuable first slice:
- `users` — identity + ownership anchor.
- `subscriptions` — access state / plan window.
- `usage_ledger` — fixed MVP consumption trail (1 unit per analysis, 1 per generation).

Defer for later slices:
- document ingestion (`source_documents`)
- analysis pipeline (`document_analysis_jobs`, `analysis_results`)
- template library (`templates`, `template_entities`, `template_fields`, `template_rules`, `field_source_traces`)
- case generation (`cases`, `case_field_values`, `generated_documents`, `document_exports`)
- audit/event stream (`activity_events`) unless needed to support the first slice’s operations

Day-1 invariants:
- user ownership stays strict and single-tenant by design.
- `usage_ledger` is append-only.
- subscription/usage state must be queryable without business logic leaking into controllers.
- keep RLS aligned with sensitive user-owned tables once those tables exist; don’t invent cross-user sharing paths.
- no template versioning, no premature denormalization, no provider-specific columns in core entities.

Connection to NestJS bootstrap:
- keep `apps/api` as a technical shell: env validation, DB readiness, graceful shutdown.
- add only the minimum future-ready boundaries: repository/module folders and connection lifecycles, not business workflows.
- don’t wire migrations/seeds/use-cases yet; the first implementation slice should stop at schema + technical persistence plumbing.

### Risks
- Starting with analysis/templates instead of identity/usage will create dependency churn and blur ownership boundaries.
- Prematurely adding activity/event or full auditing tables increases surface area before the core spine exists.
- If RLS is deferred too long, later backfilling access rules becomes more brittle.
- Over-modeling early (versioning, provider metadata, optional JSONB everywhere) would slow the first real delivery.

### Ready for Proposal
Yes — the repo is ready for a narrowly scoped proposal around the **identity + usage PostgreSQL foundation** and technical NestJS persistence boundaries.
