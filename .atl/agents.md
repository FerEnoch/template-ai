# template-ai — Project Agent Guidance

**This file is a project-level supplement to your global `AGENTS.md`.**
It provides stack-specific conventions, auto-load skill mappings, and project references that complement (not replace) your personal agent configuration.

> **Note for new collaborators**: Your opencode global configuration is typically at `~/.config/opencode/AGENTS.md` (or the equivalent for your setup). This project file adds context on top of that global baseline.

---

## Core Reasoning Principle

**Prioritize retrieval-led reasoning over pretrained-knowledge-led reasoning.**

When solving problems, always search project memory and codebase first before relying on general knowledge. Check Engram, look at existing patterns, and derive answers from what's already there rather than defaulting to what you "know."

---

## Stack

- **Package Manager**: pnpm (NO npm, NO yarn)
- **Frontend**: Next.js + React
- **Backend**: NestJS + TypeScript
- **Database**: PostgreSQL (source of truth)
- **Object Storage**: Cloud Storage for Firebase
- **LLM Routing**: OpenRouter (encapsulated interface)
- **Async**: BullMQ + Redis (heavy jobs only)
- **Testing**: Vitest (frontend), backend runner defined by app scripts
- **Container**: Docker + Docker Compose per environment

---

## Supply Chain Security

**Strict Lockfile (mandatory)**:

- CI/CD: `pnpm install --frozen-lockfile` — ALWAYS
- Local development: `pnpm install` (allows lockfile updates if package.json changed)
- If lockfile doesn't satisfy package.json → FAILS

**Vulnerability Audit**:

- Run `pnpm audit` in CI pipeline before each merge
- HIGH or CRITICAL vulnerabilities → blocker until resolved
- Review advisory before ignoring (never ignore blindly)

**Package Verification**:

- Do NOT blindly trust dependency updates
- Review changelog of critical dependencies before updating
- Prefer fixed versions (e.g., `"package": "1.2.3"` not `"package": "^1.2.0"`) in production

**Public Registry Packages**:

- Prefer packages with high downloads + active maintenance
- Check last update (abandonware = risk)
- Avoid packages with unresolved vulnerability history

---

## Testing Rules

- Unit/Integration: **Vitest**
- E2E: Playwright
- Test files alongside the file they test: `*.test.ts`
- Naming: `*.spec.ts` or `*.test.ts` (not both)
- Minimum coverage: happy path + common errors
- Mock ports: verify behavior, not implementation

---

## Architecture

**Ports and Adapters** — Every external service defines an interface in domain:

```
domain/src/ports/              ← interfaces (ports)
infrastructure/src/adapters/   ← concrete implementations
```

- OCR, storage, LLM, auth: always through port
- No hardcoding providers in use cases
- Easy replacement without breaking domain

---

## Code Conventions

- **TypeScript strict mode** enabled
- **ESLint + Prettier** in pipeline
- Relative paths from workspace root: `@template-ai/{module}`
- Entities with PascalCase: `Plantilla`, `CaseData`, `Entity`
- Services with suffix `Service`: `ExtractionService`, `PlantillaService`
- DTOs with suffix `DTO`: `CreatePlantillaDTO`, `GenerateDocumentDTO`
- Repositories with suffix `Repository`
- Test suites: `describe('when...')` — natural language

---

## Product Language (for user-facing outputs)

| From agent         | For user                        |
| ------------------ | ------------------------------- |
| placeholder        | area or field to complete       |
| template           | template                        |
| schema             | structure                       |
| OCR / extraction   | document analysis               |
| entity             | entity (part, asset, file...)   |
| case data          | case data                       |

**Rule**: if the output is seen by the user → use legal domain terms, not technical ones.

---

## Product Priorities

1. **Human review** > perfect detection (user always validates)
2. **Trust** > blind speed (show what was detected, where it came from)
3. **Simple language** > technical jargon (avoid "token", "placeholder", "endpoint")
4. **Honest fallback** > false progress (if unsure, say so)

---

## Environments

- `compose.dev.yaml` — local development
- `compose.test.yaml` — isolated testing
- `.env.dev`, `.env.test` — separate configuration
- Makefile as interface ONLY for PostgreSQL/local infra: `make dev`, `make test-db-up`, `make smoke`
- App commands (dev/start/lint/typecheck): `pnpm` (`pnpm dev:web`, `pnpm dev:api`, `pnpm lint`, `pnpm typecheck`)

No DB sharing between dev and test.

**pnpm configuration file** (mandatory):

- Create `.npmrc` with `prefer-frozen-lockfile=true` to enforce locally

---

## Auto-load Skills (always active for this project)

When these contexts are detected, the corresponding skill is auto-loaded:

| Context                  | Skill                                    | Notes |
| ------------------------ | ---------------------------------------- | ----- |
| Vitest tests             | **go-testing**                           | Reference for patterns (testing patterns are universal) |
| New port/adapter         | **nodejs-backend-patterns**              | For backend interface design |
| New API                  | **api-design-principles**                | For API design |
| Product UI               | **frontend-design**                      | For product interfaces |
| Network/infra errors     | **error-handling-patterns**             | For resilience patterns |
| Security review          | **security-engineer**                   | For security-sensitive code |
| Database design          | **database-optimizer** / **postgresql-table-design** | For schema and queries |

Your global `AGENTS.md` handles the base skill loading. This file adds project-specific mappings on top.

---

## Private Files (clone to populate your own)

The `.atl/private/` directory contains team-specific configuration. **It is gitignored** so each collaborator populates their own.

Expected private files:

| Private file                          | Purpose                                      |
| ------------------------------------- | -------------------------------------------- |
| `.atl/private/expert-agents.md`       | Expert agent routing table (when to invoke specialized agents by domain) |
| `.atl/private/skill-registry.md`      | Extended or custom skill mappings for this project |
| *(add your own as needed)*            | Any project-specific agent configuration     |

**To set up**: copy the template structure from public docs or create your own `private/` files to customize expert routing and skill behavior for your team.

---

## Public References

- Stack ADR: `docs/stack-technological-adr.md`
- PRD MVP: `docs/prd-mvp-template-ai.md`
- Domain model: `docs/domain-conceptual-model.md`
- Skill registry (public subset): `.atl/skill-registry.md`

---
