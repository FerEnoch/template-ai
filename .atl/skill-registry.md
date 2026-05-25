# Skill Registry

**Delegator use only.** Any agent that launches sub-agents reads this registry to resolve compact rules, then injects them directly into sub-agent prompts. Sub-agents do NOT read this registry or individual SKILL.md files.

## User Skills

| Trigger | Skill | Path |
|---------|-------|------|
| When creating a pull request, opening a PR, or preparing changes for review. | branch-pr | /home/ferenoch/.config/opencode/skills/branch-pr/SKILL.md |
| Cualquier dominio especializado — backend, seguridad, diseño, testing, marketing, game dev, y más. | agent-router | /home/ferenoch/.config/opencode/skills/agent-router/SKILL.md |
| Cuando se delega trabajo a sub-agentes en fases SDD. | dynamic-model-selector | /home/ferenoch/.config/opencode/skills/dynamic-model-selector/SKILL.md |
| When writing Go tests, using teatest, or adding test coverage. | go-testing | /home/ferenoch/.config/opencode/skills/go-testing/SKILL.md |
| When creating a GitHub issue, reporting a bug, or requesting a feature. | issue-creation | /home/ferenoch/.config/opencode/skills/issue-creation/SKILL.md |
| When user says "judgment day", "judgment-day", "review adversarial", "dual review". | judgment-day | /home/ferenoch/.config/opencode/skills/judgment-day/SKILL.md |
| "set up OpenRouter", "use OpenRouter SDK", "add OpenRouter", "configure OpenRouter provider", "@openrouter/agent" | openrouter-typescript-sdk | /home/ferenoch/.config/opencode/skills/openrouter-typescript-sdk/SKILL.md |
| When user asks to create a new skill, add agent instructions, or document patterns for AI. | skill-creator | /home/ferenoch/.config/opencode/skills/skill-creator/SKILL.md |
| — | adapt | /home/ferenoch/.agents/skills/adapt/SKILL.md |
| — | animate | /home/ferenoch/.agents/skills/animate/SKILL.md |
| designing new APIs, reviewing API specifications, or establishing API design standards | api-design-principles | /home/ferenoch/.agents/skills/api-design-principles/SKILL.md |
| — | audit | /home/ferenoch/.agents/skills/audit/SKILL.md |
| — | bolder | /home/ferenoch/.agents/skills/bolder/SKILL.md |
| — | clarify | /home/ferenoch/.agents/skills/clarify/SKILL.md |
| — | colorize | /home/ferenoch/.agents/skills/colorize/SKILL.md |
| — | create-agent | /home/ferenoch/.agents/skills/create-agent/SKILL.md |
| — | critique | /home/ferenoch/.agents/skills/critique/SKILL.md |
| — | delight | /home/ferenoch/.agents/skills/delight/SKILL.md |
| — | deployment-pipeline-design | /home/ferenoch/.agents/skills/deployment-pipeline-design/SKILL.md |
| creating design tokens, implementing theme switching, building component libraries, or establishing design system foundations | design-system-patterns | /home/ferenoch/.agents/skills/design-system-patterns/SKILL.md |
| — | distill | /home/ferenoch/.agents/skills/distill/SKILL.md |
| implementing E2E tests, debugging flaky tests, or establishing testing standards | e2e-testing-patterns | /home/ferenoch/.agents/skills/e2e-testing-patterns/SKILL.md |
| implementing error handling, designing APIs, or improving application reliability | error-handling-patterns | /home/ferenoch/.agents/skills/error-handling-patterns/SKILL.md |
| — | extract | /home/ferenoch/.agents/skills/extract/SKILL.md |
| — | find-skills | /home/ferenoch/.agents/skills/find-skills/SKILL.md |
| — | frontend-design | /home/ferenoch/.agents/skills/frontend-design/SKILL.md |
| setting up CI/CD with GitHub Actions, automating development workflows, or creating reusable workflow templates | github-actions-templates | /home/ferenoch/.agents/skills/github-actions-templates/SKILL.md |
| — | harden | /home/ferenoch/.agents/skills/harden/SKILL.md |
| — | interface-design | /home/ferenoch/.agents/skills/interface-design/SKILL.md |
| creating Node.js servers, REST APIs, GraphQL backends, or microservices architectures | nodejs-backend-patterns | /home/ferenoch/.agents/skills/nodejs-backend-patterns/SKILL.md |
| — | normalize | /home/ferenoch/.agents/skills/normalize/SKILL.md |
| — | onboard | /home/ferenoch/.agents/skills/onboard/SKILL.md |
| — | optimize | /home/ferenoch/.agents/skills/optimize/SKILL.md |
| — | polish | /home/ferenoch/.agents/skills/polish/SKILL.md |
| — | postgresql-table-design | /home/ferenoch/.agents/skills/postgresql-table-design/SKILL.md |
| optimizing prompts, improving LLM outputs, or designing production prompt templates | prompt-engineering-patterns | /home/ferenoch/.agents/skills/prompt-engineering-patterns/SKILL.md |
| — | quieter | /home/ferenoch/.agents/skills/quieter/SKILL.md |
| building adaptive interfaces, implementing fluid layouts, or creating component-level responsive behavior | responsive-design | /home/ferenoch/.agents/skills/responsive-design/SKILL.md |
| writing smart contracts, auditing existing contracts, or implementing security measures for blockchain applications | solidity-security | /home/ferenoch/.agents/skills/solidity-security/SKILL.md |
| creating component libraries, implementing design systems, or standardizing UI patterns | tailwind-design-system | /home/ferenoch/.agents/skills/tailwind-design-system/SKILL.md |
| — | teach-impeccable | /home/ferenoch/.agents/skills/teach-impeccable/SKILL.md |
| implementing complex type logic, creating reusable type utilities, or ensuring compile-time type safety in TypeScript projects | typescript-advanced-types | /home/ferenoch/.agents/skills/typescript-advanced-types/SKILL.md |
| — | vercel-react-best-practices | /home/ferenoch/.agents/skills/vercel-react-best-practices/SKILL.md |
| Converting frontend code to Stitch, migrating web apps into Stitch, uploading existing app designs. | stitch-code-to-design | /home/ferenoch/.config/opencode/skills/stitch-code-to-design/SKILL.md |
| Extracting design system from source code, auditing visual language, pulling design tokens from a codebase, understanding styling patterns. | stitch-extract-design-md | /home/ferenoch/.config/opencode/skills/stitch-extract-design-md/SKILL.md |
| Capturing UI state as self-contained HTML, sharing static page versions, preparing assets for Stitch, saving HTML or mocking views. | stitch-extract-static-html | /home/ferenoch/.config/opencode/skills/stitch-extract-static-html/SKILL.md |
| Generating screens from text prompts in Stitch, editing screens with design tokens, creating design variants. | stitch-generate-design | /home/ferenoch/.config/opencode/skills/stitch-generate-design/SKILL.md |
| Building websites iteratively with Stitch, autonomous baton-passing loop, continuous frontend generation. | stitch-loop | /home/ferenoch/.config/opencode/skills/stitch-loop/SKILL.md |
| Managing design systems in Stitch, creating/updating design tokens, applying themes to screens. | stitch-manage-design-system | /home/ferenoch/.config/opencode/skills/stitch-manage-design-system/SKILL.md |
| Uploading assets (images, mockups, HTML) to a Stitch project, bypassing MCP base64 limits. | stitch-upload-to-stitch | /home/ferenoch/.config/opencode/skills/stitch-upload-to-stitch/SKILL.md |

## Compact Rules

### branch-pr
- Every PR MUST link an approved issue.
- Use exactly one `type:*` label.
- Use branch names matching `type/description` in lowercase.
- Follow conventional commits; no AI attribution trailers.
- Ensure required checks pass before merge.

### agent-router
- Use when the task enters any specialized domain: engineering, design, security, database, testing, marketing, game dev, product, sales, etc.
- Check local opencode skills first (`~/.config/opencode/skills/`), then fallback to copilot agents (`~/.copilot/agents/`).
- Load the matching skill using the `skill` tool before making recommendations.
- Apply imported patterns to the current codebase, not as generic advice.
- Prefer domain expertise over surface-level generic solutions.

### dynamic-model-selector
- Use the phase-to-model matrix as the default choice.
- Escalate to the strongest reasoning model for high-complexity work.
- Treat architecture, security, deep debugging, and risky refactors as high complexity.
- Optimize for quality first on complex SDD phases.
- Keep the selection explicit and justified.

### go-testing
- Prefer table-driven tests for pure or parameterized logic.
- Test Bubbletea model transitions directly through `Update()` when possible.
- Use teatest for interactive TUI flows.
- Use golden files for stable rendered output.
- Cover success and error paths explicitly.

### issue-creation
- Always use the correct issue template; blank issues are not acceptable.
- Search for duplicates before creating a new issue.
- Expect `status:needs-review` first, then wait for `status:approved`.
- Send questions to Discussions, not Issues.
- Fill required fields completely with reproducible detail.

### judgment-day
- Run two independent blind reviews against the same target.
- Resolve project standards from the skill registry before judging.
- Classify findings as CRITICAL, WARNING(real), WARNING(theoretical), or SUGGESTION.
- Fix confirmed issues surgically, then re-judge when required.
- Ask the user before continuing after repeated unresolved rounds.

### openrouter-typescript-sdk
- Install and use `@openrouter/sdk` as the primary integration surface.
- Prefer `callModel()` over lower-level request wiring.
- Define tools with Zod input/output schemas.
- Set explicit stop conditions to control cost and runaway loops.
- Handle auth, rate limits, credits, and fallback errors deliberately.

### skill-creator
- Create a skill only for reusable, non-trivial patterns.
- Use the standard `skills/{skill-name}/SKILL.md` structure.
- Keep frontmatter complete, including trigger language.
- Put actionable rules first; keep examples minimal.
- Register the new skill in project agent guidance.

### adapt
- Make the design work across screen sizes, devices, and contexts.
- Preserve usability and hierarchy while adapting layouts.
- Favor systematic responsive changes over one-off overrides.
- Keep interaction patterns consistent across breakpoints.
- Avoid regressions in accessibility or readability.

### animate
- Add motion only when it clarifies state or improves feel.
- Prefer subtle transitions and purposeful micro-interactions.
- Keep animation durations short and responsive.
- Avoid motion that distracts from task completion.
- Respect usability and reduced-motion expectations.

### api-design-principles
- Model APIs around resources and clear domain types.
- Use HTTP or GraphQL semantics consistently.
- Design pagination, filtering, and errors as first-class concerns.
- Prefer predictable naming and versioning strategies.
- Optimize for long-term developer ergonomics, not shortcuts.

### audit
- Review the interface across accessibility, performance, theming, and responsiveness.
- Classify issues by severity and impact.
- Report concrete findings, not vague impressions.
- Prefer actionable recommendations with clear remediation paths.
- Evaluate both user experience and implementation quality.

### bolder
- Increase visual impact without breaking clarity.
- Push emphasis through contrast, scale, and hierarchy intentionally.
- Keep the result usable, not noisy.
- Amplify the strongest existing visual ideas.
- Avoid random decoration that weakens the system.

### clarify
- Rewrite unclear copy into simpler, user-centered language.
- Prefer explicit labels, errors, and instructions.
- Remove jargon unless the audience requires it.
- Keep tone consistent with the product voice.
- Optimize for comprehension under stress and ambiguity.

### colorize
- Introduce color strategically, not everywhere.
- Use color to support hierarchy, state, and brand expression.
- Keep contrast and accessibility compliant.
- Preserve semantic consistency across statuses.
- Avoid over-saturating neutral or document-heavy interfaces.

### create-agent
- Separate agent core from UI or transport layers.
- Use OpenRouter SDK as the model integration layer.
- Model tools and hooks explicitly for extensibility.
- Keep secrets in environment variables only.
- Favor modular structure that supports headless and TUI modes.

### critique
- Evaluate hierarchy, flow, resonance, and clarity.
- Separate structural UX issues from cosmetic preferences.
- Give actionable feedback tied to user goals.
- Explain why something works or fails.
- Prioritize the highest-leverage improvements first.

### delight
- Add small moments of personality that support the experience.
- Keep delight in service of usability, not novelty.
- Focus on memorable but low-friction touches.
- Preserve trust and professionalism in core flows.
- Avoid delight that slows or confuses critical tasks.

### deployment-pipeline-design
- Design pipelines as staged systems with explicit gates.
- Include build, test, verification, approval, deployment, and rollback paths.
- Match rollout strategy to risk, downtime tolerance, and recovery needs.
- Use automated metrics and health checks where possible.
- Treat rollback readiness as part of the design, not an afterthought.

### design-system-patterns
- Structure tokens in primitive, semantic, and component layers.
- Use CSS variables or equivalent theming primitives consistently.
- Build component APIs around variants, slots, and composition.
- Keep token naming semantic and portable.
- Treat system consistency as a product capability, not just styling.

### distill
- Remove unnecessary UI and content complexity.
- Keep only elements that support the core task.
- Strengthen hierarchy by subtraction first.
- Prefer simpler flows over feature-heavy screens.
- Make the interface feel inevitable, not busy.

### e2e-testing-patterns
- Reserve E2E tests for critical user journeys.
- Test behavior, not implementation details.
- Keep tests deterministic and isolated.
- Use stable selectors and CI-friendly configuration.
- Balance E2E coverage with faster unit/integration layers.

### error-handling-patterns
- Design error paths as deliberately as success paths.
- Propagate errors with useful context.
- Prefer explicit failure modeling over silent fallbacks.
- Degrade gracefully when full success is impossible.
- Keep operational errors observable and actionable.

### extract
- Identify repeated UI or interaction patterns worth consolidating.
- Turn ad hoc solutions into reusable components or tokens.
- Preserve semantics while reducing duplication.
- Extract at the right abstraction level, not prematurely.
- Document reuse through naming and structure.

### find-skills
- Search for an existing skill before inventing process from scratch.
- Match the user's intent to installed capabilities.
- Prefer reusable skill-based workflows when available.
- Suggest installation or adoption paths when a skill fits.
- Avoid duplicating guidance already captured in skills.

### frontend-design
- Build production-grade interfaces, not generic mockups.
- Aim for strong hierarchy, spacing, and visual character.
- Keep implementation realistic for the chosen frontend stack.
- Avoid default AI-looking compositions and clichés.
- Balance creativity with maintainability and accessibility.

### github-actions-templates
- Use workflow stages for install, lint, test, build, and deploy as needed.
- Prefer caching and matrix strategies intentionally.
- Keep secrets in GitHub-provided secret stores only.
- Separate CI validation from deployment concerns.
- Make workflows reproducible, secure, and easy to debug.

### harden
- Improve resilience against edge cases, overflow, and failure states.
- Handle empty, loading, error, and extreme-content scenarios.
- Consider i18n, long text, and degraded environments.
- Keep the interface stable under imperfect data.
- Fix robustness issues before polishing aesthetics.

### interface-design
- Focus on apps, tools, dashboards, and interactive product surfaces.
- Optimize for workflows, density, and task clarity.
- Design structure before visual embellishment.
- Support repeated use, not one-time marketing impact.
- Keep controls discoverable and logically grouped.

### nodejs-backend-patterns
- Organize code into clear layers such as routes, services, and repositories.
- Validate inputs at the boundary.
- Centralize error handling and operational concerns.
- Use middleware/plugins deliberately for security and observability.
- Design for maintainability before framework cleverness.

### normalize
- Bring UI into alignment with the existing design language.
- Standardize spacing, typography, and component usage.
- Reduce visual drift across screens and states.
- Prefer system consistency over isolated local optimizations.
- Keep normalization incremental and low risk.

### onboard
- Help first-time users reach value quickly.
- Use onboarding, empty states, and cues to reduce confusion.
- Explain just enough, right when needed.
- Keep setup progressive instead of overwhelming.
- Align onboarding with the product's core promise.

### optimize
- Improve speed, rendering efficiency, and perceived performance.
- Focus first on the largest bottlenecks.
- Reduce unnecessary work in network, CPU, and layout.
- Preserve UX quality while making things faster.
- Measure before and after when possible.

### polish
- Fix the small inconsistencies that make interfaces feel unfinished.
- Tune spacing, alignment, borders, and visual rhythm.
- Preserve the intended design direction while refining details.
- Remove rough edges across states and flows.
- Treat polish as the final pass, not a substitute for structure.

### postgresql-table-design
- Choose PostgreSQL types, constraints, and indexes intentionally.
- Model data integrity in the schema, not only in code.
- Design for query patterns and growth.
- Use advanced PostgreSQL features when they simplify correctness.
- Review tradeoffs between normalization, performance, and operability.

### prompt-engineering-patterns
- Write prompts for reliability, control, and repeatability.
- Make instructions explicit, scoped, and testable.
- Separate task, constraints, and output contract clearly.
- Add guardrails for tools, costs, and failure modes.
- Optimize prompts as production interfaces, not one-off prose.

### quieter
- Reduce visual intensity without flattening meaning.
- Tone down contrast, color, or motion where the interface feels aggressive.
- Keep hierarchy intact while softening presentation.
- Prefer calm over dull, and restraint over blandness.
- Preserve accessibility when reducing emphasis.

### responsive-design
- Start mobile-first and scale upward intentionally.
- Prefer container queries and fluid sizing when appropriate.
- Use grid and flex patterns based on content needs.
- Choose breakpoints from layout pressure, not habit alone.
- Preserve readability and interaction quality at every size.

### solidity-security
- Apply checks-effects-interactions for external calls.
- Use proven access control and reentrancy protections.
- Treat every external interaction as hostile until verified safe.
- Rely on safe arithmetic semantics and audited libraries.
- Optimize gas only after preserving security properties.

### tailwind-design-system
- Use Tailwind v4 CSS-first theming patterns.
- Define tokens semantically with `@theme` and custom properties.
- Build reusable variants and accessible component states.
- Keep dark mode and responsive behavior systematized.
- Prefer design-token consistency over ad hoc utility sprawl.

### teach-impeccable
- Gather project design context once and persist it for future work.
- Capture the visual and UX standards that should remain stable.
- Use it to reduce repeated restating of design expectations.
- Treat the output as project guidance, not disposable notes.
- Refresh it when the design direction materially changes.

### typescript-advanced-types
- Use advanced types to model real invariants, not to show off.
- Prefer readable generics and utility types over brittle magic.
- Leverage conditional and mapped types for reusable safety.
- Keep public types ergonomic for downstream consumers.
- Refactor complex types when they obscure intent.

### vercel-react-best-practices
- Follow React and Next.js patterns that improve performance by default.
- Prefer server-first rendering where appropriate.
- Minimize client components and unnecessary hydration.
- Keep data fetching, caching, and bundles explicit.
- Align implementation with modern Vercel guidance, not legacy habits.

### stitch-code-to-design
- Chain three skills in sequence: extract-static-html → extract-design-md → upload-to-stitch.
- Start by building the app and extracting a self-contained HTML file.
- Extract the design system from source code before uploading to Stitch.
- Upload both the HTML and DESIGN.md to the target Stitch project.
- Do not proceed without a valid Stitch projectId.

### stitch-extract-design-md
- Analyze frontend source files (no build needed) to extract the visual design language.
- Detect framework first (React, Vue, Svelte, Angular, plain CSS) to choose extraction patterns.
- Extract colors with descriptive names and functional roles, deduplicating near-duplicates.
- Document typography as a complete system: fonts, scale, weights, letter-spacing, line-height.
- Analyze 4-5 key component types: buttons, cards, navigation, inputs, and domain-specific components.
- Write DESIGN.md with YAML frontmatter containing name and color mapping.
- Output goes to `.stitch/DESIGN.md`.
- The atmosphere section should read like editorial copy, not technical documentation.

### stitch-extract-static-html
- Extract self-contained HTML from a running web app using Puppeteer (Strategy A, recommended).
- Run `npx tsx snapshot.ts --url <URL> --output <path> --wait <ms>`.
- Inlines all CSS and converts images to base64 automatically.
- For multi-page apps, run once per route with appropriate --wait values.
- Strategy B (browser subagent) only when page interaction is needed first.
- Static fallback (MockPage.jsx) as last resort when app cannot run locally.
- Ask the user which strategy to use — do not choose automatically.

### stitch-generate-design
- Enhance user prompts with professional UI/UX terminology before generation.
- Never include colors, fonts, or theme instructions in generation prompts — the design system handles those.
- Use edit flow for targeted adjustments, not full re-generation from scratch.
- Structure generation prompts by platform, page sections, and content description.
- Download design assets to `.stitch/designs/` after every generation or edit.
- Present AI feedback (outputComponents) to the user after every tool call.
- For image-based generation, upload the image first, then refine with edit_screens.

### stitch-loop
- Autonomous baton-passing loop: read `.stitch/next-prompt.md` → generate → integrate → write next task.
- Consult `.stitch/SITE.md` for sitemap and roadmap before generating each page.
- Copy the design system block from `.stitch/DESIGN.md` into every generation prompt.
- Move generated pages from `.stitch/designs/` to `site/public/` and wire navigation links.
- Update `.stitch/next-prompt.md` with the next task before completing — this keeps the loop alive.
- Persist project and screen metadata in `.stitch/metadata.json`.
- Do not recreate pages that already exist in the sitemap.

### stitch-manage-design-system
- Create or update design system in Stitch: upload DESIGN.md → call `create_design_system_from_design_md`.
- Use `upload_to_stitch.py` script for DESIGN.md uploads (bypasses MCP base64 output token limits).
- Apply design system to existing screens with `apply_design_system`.
- `selectedScreenInstances` must contain ONLY `id` and `sourceScreen` (no position/dimension fields).
- Ask the user for confirmation before uploading any design system.
- Extract existing design tokens from screens using design-md when available.

### stitch-upload-to-stitch
- Use `upload_to_stitch.py` script (not MCP tool) to bypass base64 output token limits.
- Requires: `--project-id`, `--file-path`, `--api-key` (and optionally `--api-url`, `--title`).
- Supported file types: .png, .jpg/.jpeg, .webp, .html/.htm.
- Find API key in MCP config: `~/.gemini/settings.json`, `.gemini/antigravity/mcp_config.json`, or `~/.claude.json`.
- Ask the user for confirmation before uploading any file.

## Project Conventions

| File | Path | Notes |
|------|------|-------|
| Project Agent Guidance | `.atl/AGENTS.md` | Stack conventions, testing rules, architecture, code conventions, product language |
| Stack ADR | `docs/stack-technological-adr.md` | Technology decisions and rationale |
| PRD MVP | `docs/prd-mvp-template-ai.md` | Product requirements and domain workflows |
| Domain Conceptual Model | `docs/domain-conceptual-model.md` | Domain entities and relationships |

Read the convention files listed above for project-specific patterns and rules. All referenced paths have been extracted — no need to read index files to discover more.
