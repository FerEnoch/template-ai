# ai-prompt-engine Specification

## Purpose

Separate AI prompts from code into versioned, loadable template files with a shared safety preamble, extraction-time chain-of-thought, and post-generation verification. Enable prompt tuning without deploys.

## Requirements

| # | Requirement | Strength | Summary |
|---|------------|----------|---------|
| R1 | Loadable prompt files | MUST | `apps/api/src/ai/prompts/` holds `.md` templates with `{{variable}}` interpolation |
| R2 | Unified safety preamble | MUST | Every prompt SHALL prepend `SAFETY_PREAMBLE` (honesty, no-inference, privacy) |
| R3 | Chain-of-thought extraction | SHALL | Extraction prompt includes CoT step before entity output |
| R4 | Post-generation verification | SHALL | Second cheap call checks for unresolved `[COMPLETAR]` markers |
| R5 | `[COMPLETAR]` guidelines | MUST | Prompt instructs model to use `[COMPLETAR]` for missing data, explain in footnote |
| R6 | Mexican legal tone/style | SHOULD | Prompts specify formal Mexican legal register and formatting preservation |
| R7 | Confidence criteria | MUST | Prompt defines ALTA/MEDIA/BAJA thresholds: exact match/multiple sources vs. inferred |
| R8 | "Don't invent" rules | MUST | Prompt forbids hallucinating entities not present in document text |
| R9 | Expanded few-shot blocks | SHALL | Include laboral and mercantil examples alongside real-estate |
| R10 | Conflict-resolution rules | SHOULD | When values conflict, prefer explicit clause text over boilerplate |
| R11 | Prompt file versioning | SHALL | Template files tracked in git; changes reviewed like code |
| R12 | Prompt engine API | MUST | `PromptEngine` class with `load(name)`, `render(name, vars)`, `renderWithSafety(name, vars)` |

### Requirement R1: Loadable prompt files

The system MUST load prompt templates from `apps/api/src/ai/prompts/` as `.md` files. Templates SHALL use `{{variableName}}` for interpolation. The `PromptEngine` MUST cache loaded templates in memory.

#### Scenario: Template loads and renders

- GIVEN `prompts/extraction.md` contains "Extract entities from: `{{documentText}}`"
- WHEN `PromptEngine.render("extraction", { documentText: "Contrato..." })` is called
- THEN the returned string contains "Extract entities from: Contrato..."

#### Scenario: Missing variable throws at render time

- GIVEN a template references `{{fewShot}}` and the vars object omits it
- WHEN `PromptEngine.render()` is called
- THEN a `PromptRenderError` is thrown with the missing variable name

### Requirement R2: Unified safety preamble

The system MUST prepend a shared `SAFETY_PREAMBLE` to every task-specific prompt. The preamble SHALL instruct: never infer non-present data, never expose PII, decline off-topic requests.

#### Scenario: Safety preamble prepended to extraction

- GIVEN `SAFETY_PREAMBLE` is defined in `prompts/_shared/safety.md`
- WHEN `PromptEngine.renderWithSafety("extraction", vars)` is called
- THEN the output starts with the safety preamble content

### Requirement R3: Chain-of-thought extraction

The extraction prompt SHALL include a CoT step: (1) identify document type, (2) list candidate spans, (3) classify with confidence.

#### Scenario: Extraction prompt includes CoT instructions

- GIVEN the rendered extraction prompt
- WHEN the prompt content is inspected
- THEN it contains "Reason step by step" or equivalent CoT directive

### Requirement R4: Post-generation verification

After document generation, the system SHALL call a verification model with a cheap/fast configuration. It MUST scan for unresolved `[COMPLETAR]` markers and structural integrity.

#### Scenario: Document with [COMPLETAR] fails verification (soft)

- GIVEN generated text contains "El Sr. [COMPLETAR] domiciliado en..."
- WHEN the verification prompt runs
- THEN the result flags the marker with position and warns user — does NOT block download

#### Scenario: Clean document passes verification

- GIVEN generated text has zero `[COMPLETAR]` markers
- WHEN verification runs
- THEN result is `{ passed: true, warnings: [] }`

### Requirement R5: [COMPLETAR] guidelines

The generation prompt MUST instruct the model to use `[COMPLETAR]` for missing data and append a footnote listing each marker with its missing field name.

#### Scenario: Footnote lists all [COMPLETAR] markers

- GIVEN the model cannot determine the rental amount
- WHEN generation runs
- THEN output contains `[COMPLETAR]` in the amount position AND a footnote: "※ [COMPLETAR]: Monto de renta no especificado en el documento origen"

### Requirement R7: Confidence criteria

The prompt MUST define: `ALTA` = text is an exact match to a document clause; `MEDIA` = inferred from context with high certainty; `BAJA` = ambiguous or derived from indirect language.

#### Scenario: Exact match yields ALTA

- GIVEN document text says "El precio de venta es de $500,000 MXN"
- WHEN the model extracts `value: "$500,000 MXN"` matching the exact text
- THEN `confidence` is `ALTA`

### Requirement R8: "Don't invent" rules

The prompt MUST instruct: "Solo extrae datos que aparecen explícitamente en el documento. No inventes nombres, fechas, montos, o cláusulas."

## Notes

- All prompts live under `apps/api/src/ai/prompts/` with subdirectories per task (`extraction/`, `classification/`, `generation/`, `_shared/`).
- The `SAFETY_PREAMBLE` is in `prompts/_shared/safety.md` and is never task-specific.
- Prompt file versioning is implicit via git — no separate version registry for MVP.
