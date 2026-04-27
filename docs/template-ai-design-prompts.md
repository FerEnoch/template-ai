# template-ai — Design Prompts (Nano Banana Pro)

**Versión:** 1.4  
**Fecha:** Abril 2026  
**Herramienta:** Google Flow (Nano Banana Pro)  
**Producto:** template-ai

---

## 🎯 Objetivo

Este documento define prompts de alta calidad para explorar UI del MVP de **template-ai** en Google Flow con dos metas simultáneas:

1. generar mockups consistentes y realistas (no “pantallas lindas sueltas”);
2. dejar handoff frontend con baja ambigüedad estructural.

Los prompts están en **inglés** (mejor rendimiento del modelo), mientras que la guía y criterios de calidad están en **español**.

Dirección de producto obligatoria:
- serio, legal, calmado, accountable;
- desktop-first;
- revisión humana obligatoria;
- límites y fallbacks honestos;
- sin estética startup-consumer;
- sin complejidad técnica innecesaria para el usuario.

---

## 🧭 Guía rápida de uso (Google Flow)

1. Abrí [flow.google](https://flow.google) y creá proyecto nuevo.
2. Modelo: **Nano Banana Pro**.
3. Aspect ratio por defecto: **16:9**.
4. Pegá un prompt completo de este pack.
5. Generá 4 variantes, elegí 1 dirección base.
6. Iterá con follow-ups de precisión (layout, estados, densidad, consistencia).

---

## 🧱 Framework v1.4 (aplica a TODOS los prompts)

### A) Prompt anatomy / Rendering contract

Cada prompt de pantalla debe incluir explícitamente:

1. **Screen intent**: para qué tarea existe.
2. **Layout contract**: regiones visibles + proporciones aproximadas.
3. **Visible data contract**: qué datos mínimos se ven por fila/tarjeta/módulo.
4. **Interaction contract**: qué es clickeable, estados hover/focus/disabled, bloqueos.
5. **State contract**: loading / empty / error / success / overflow.
6. **Consistency contract**: qué componentes se reutilizan idénticos del shell/sistema.

### B) Screen-spec checklist (rápida)

Antes de considerar “buena” una imagen, validar:

- ¿Se entienden zonas de layout sin adivinar?  
- ¿Cada tabla/form tiene columnas/campos con contrato visible?  
- ¿Hay estado por defecto y estado límite (vacío/error/overflow)?  
- ¿Los CTA tienen criterio de habilitación claro?  
- ¿Se ve reusable o parece composición one-off?  
- ¿Se sostiene en escala de texto largo e i18n?

### C) Reusable shell rules

- Shell base consistente: **top bar + sidebar + page header + content**.
- Grilla desktop fija (1440px): gutters consistentes, alineación estricta.
- Sidebar siempre secundaria; contenido de tarea siempre dominante.
- Evitar héroes, métricas de marketing y ruido ornamental.

### D) Component extraction hints (handoff frontend)

Diseñar cada pantalla como ensamblaje de piezas reusables:

- `AppShell`, `PageHeader`, `SectionCard`
- `DataTable`, `TableRowActions`, `StatusChip`
- `ConfidenceBadge`, `TraceBadge`, `VariationBadge`
- `InlineWarningBar`, `ErrorSummaryBar`
- `Stepper`, `SkeletonBlock`
- `EmptyState`, `FailPanel`, `ConfirmModal`

Si un bloque no podría convertirse en componente sin rediseñarlo, el prompt está débil.

### E) Interaction/state fidelity rules

- Estados mínimos obligatorios por flujo: `idle`, `hover/focus`, `loading`, `disabled`, `error`, `success`, `blocked-by-limit`.
- Toda acción bloqueada debe explicar **por qué** y **qué hacer**.
- Toda incertidumbre (BAJA confianza, sin traza, análisis fallido) debe ser explícita y no maquillada.
- No inventar acciones que no existan en el contrato del producto.

---

## 🔩 Reglas obligatorias de alineación UI ↔ dominio

Aplican a todos los prompts, variantes y follow-ups.

1. **Entidades dinámicas, no taxonomía fija**
   - “Partes”, “Inmueble”, “Fechas” son ejemplos.
   - Soportar `N` grupos, editable/reordenable, potencialmente vacío.

2. **Contrato visible por fila de campo**
   - Cada fila variable debe poder mostrar: `label`, `required`, `group`, `confidence`, `trace_state`, `variation_rule`, `actions`.
   - `trace_state`: `con_traza` (página + extracto) / `sin_traza` (agregado manual).
   - `variation_rule`: `none`, `optional_block`, `repeatable_simple`, `boolean_toggle`.

3. **Confianza de dominio**
   - Persistencia conceptual binaria: **ALTA / BAJA**.
   - Si hay gradaciones visuales, deben ser subestado de incertidumbre, no nuevo estado de negocio.

4. **Trazabilidad obligatoria en revisión**
   - Campo detectado: vínculo a evidencia (página + extracto).
   - Campo manual: “Sin traza (agregado manualmente)”.

5. **Estados de ejecución consistentes**
   - `pendiente`, `en_proceso`, `completado`, `fallido`.
   - `fallido` siempre con motivo claro + acción requerida.

6. **Plan único, dos tipos de operación**
   - Mostrar análisis y generación como filas separadas de un mismo plan.
   - Copy obligatorio: “Cada análisis consume 1 unidad. Cada generación consume 1 unidad.”

7. **Borrado con lenguaje operativo**
   - Diferenciar `eliminado en UI` vs `purga física en 30 días`.
   - Mostrar trazabilidad de actividad cuando aporte claridad.

8. **Densidad profesional desktop-first**
   - Tablas y formularios compactos; jerarquía fuerte; cero look “hero”.

---

## 🎨 Prompt 1 — Visual System / Design System

**Objetivo:** definir base visual, tokens y componentes transversales listos para reutilización.

**Prompt completo (EN):**

> Create a production-grade desktop UI design system board for a Spanish legal document templating product called template-ai. Tone: serious, calm, accountable, precise, trustworthy. Not a startup dashboard, not consumer SaaS. Light theme only. Canvas 1440px. Color tokens: background #f5f1e8, elevated surfaces #fdfcf9, primary text #1a1714, secondary text #5a544c, accent #3d6b8f, success #2d7a4f, warning #b07d2a, danger #c0392b, neutral #7a7570. Typography system: refined serif for legal content and legal headings; neutral geometric sans-serif for controls/data UI. Show reusable component families with explicit states and density variants: AppShell (top bar + sidebar + page header), DataTable (default/hover/selected/overflow row), compact FormRow, Inputs (default/focus/error/disabled), Select, Tabs, UploadDropzone (idle/uploading/ready/fail), Status chips (BORRADOR/VALIDADA/ARCHIVADA distinguishable beyond color), Confidence badges (ALTA/BAJA distinguishable in grayscale), Trace badges (Con traza/Sin traza), Variation badges (Opcional/Repetible/Sí-No), Inline warning bar, Error summary bar with anchors, Stepper states (pendiente/en_proceso/completado/fallido), Empty state card, Skeleton blocks, Fail panel (reason + action), Destructive modal. Include spacing scale, border radius scale, 1px hairline borders, no drop shadows, strict alignment and column rhythm.

**Aspect ratio:** `16:9`

---

## 🧩 Prompt 2 — Revisión del template *(pantalla más crítica del MVP)*

**Objetivo:** revisión humana obligatoria con trazabilidad verificable y estructura implementable.

**Prompt completo (EN):**

> Create the core template review screen for template-ai (mandatory human review gate). Desktop 1440px, split layout with explicit regions: A) left document viewer 62%, B) right review panel 38%, C) persistent bottom action bar. Region A: original legal document in serif, highlighted variable spans, click-to-focus interaction; selecting a highlight syncs to one row on the right. Region B title: “Entidades y datos detectados”. Entity groups are dynamic and editable (show example names only). Each field row must expose this visible data contract in one compact line: label (truncates with tooltip), required marker, confidence (ALTA/BAJA), trace state, variation badge, actions menu. Trace behavior contract: detected field → “Ver origen” opens page+excerpt context; manual field → explicit “Sin traza (agregado manualmente)”. Include one empty group state (“Sin campos todavía” + “Agregar campo”), and overflow handling with sticky section headers while scrolling. Add a prioritized block “Revisión prioritaria” listing BAJA rows first with per-row action “Revisar ahora”. Include “Dudas del análisis” cards (2 yes/no disambiguation questions). Bottom bar contract: text “Revisión humana obligatoria — confirmá la estructura antes de guardar”, primary CTA “Confirmar estructura” disabled until all BAJA rows are resolved/accepted, secondary “Seguir revisando”. Interaction fidelity: show hover on row, selected row state, disabled CTA state with reason microcopy.

**Aspect ratio:** `16:9`

---

## 🎨 Prompt 3 — Inicio / Escritorio de trabajo

**Objetivo:** entrada operativa del producto, sin estética de startup dashboard.

**Prompt completo (EN):**

> Design the home workspace screen for template-ai (desktop 1440px). Reuse app shell. Sidebar: “Inicio”, “Biblioteca”, “Plan y uso”. Main region contract: compact greeting header, two action cards (“Crear nueva plantilla”, “Generar documento”), and a dense “Plantillas recientes” list with columns: nombre, estado, último uso, acción rápida. Add a right-side plan snippet card with one-plan language: “Plan único — 8 análisis disponibles este mes”. Keep low noise, high structure, no hero metrics, no decorative charts.

**Aspect ratio:** `16:9`

---

## 📤 Prompt 4 — Subida de documento

**Objetivo:** subir archivo con expectativas y límites claros.

**Prompt completo (EN):**

> Create “Crear plantilla — paso 1 de 3” upload screen for template-ai, desktop 1440px. Layout regions: central dropzone, right guidance panel, bottom mandatory review notice. Dropzone contract: accepted formats badges (PDF/DOCX/JPG), and three thumbnail states (idle/uploading/ready). Guidance panel: practical file quality tips in Spanish. Add trust note with “Cómo lo tratamos” link. Bottom non-dismissible notice: “Vas a revisar todo lo que detectamos antes de guardar.” Include edge state: file rejected row with plain reason and corrective action.

**Aspect ratio:** `16:9`

---

## 🔎 Prompt 5 — Análisis del documento (progreso + confianza)

**Objetivo:** progreso honesto + fallback accionable.

**Prompt completo (EN):**

> Design “Analizando tu contrato” screen for template-ai with a strict execution-state contract. Desktop 1440px. Left: vertical stepper with 4 steps (Validando archivo, Extrayendo texto, Detectando estructura, Identificando datos del caso), each rendered as pendiente / en_proceso / completado / fallido. Main region: skeleton preview while in progress. Completion region: confidence summary split ALTA vs BAJA with operational copy. Failure region: compact fail panel with reason and exact next actions (“Reintentar”, “Subir otro archivo”, “Volver”). Include timeout-safe microcopy: “Si algo no se puede analizar con claridad, te lo decimos antes de continuar.”

**Aspect ratio:** `16:9`

---

## 💾 Prompt 6 — Guardar plantilla

**Objetivo:** cierre de flujo con confirmación concreta y estado claro.

**Prompt completo (EN):**

> Design “Guardar plantilla” screen for template-ai. Include summary card (source filename, total fields, BAJA fields manually resolved, review completed). Form contract: required “Nombre de la plantilla”, optional “Descripción breve”. Show default status VALIDADA with short explanation. Primary CTA “Guardar en mi biblioteca”, secondary “Seguir editando”, and disabled primary state when required name is empty.

**Aspect ratio:** `16:9`

---

## 📚 Prompt 7 — Biblioteca personal *(alta palanca para reutilización de componentes)*

**Objetivo:** tabla densa, filtros claros, acciones rápidas y plan visible sin ambigüedad.

**Prompt completo (EN):**

> Create a production-ready “Biblioteca” screen for template-ai, desktop 1440px, using the same shell as other screens. Layout contract: top filter toolbar, central table, right “Tu plan” panel. Table visible data contract per row: Nombre (truncated with tooltip), Estado chip (BORRADOR/VALIDADA/ARCHIVADA), Tipo de documento, Último uso, Acciones inline. Interaction contract: row hover reveals quick actions (“Usar”, “Revisar”, “Archivar”), keyboard-focus row style, sticky header, sortable columns (Nombre, Último uso). Empty contract: when no results for filters, show compact “Sin resultados” state with “Limpiar filtros”. Overflow contract: long names never push actions off-grid; actions remain clickable. Plan panel contract: one plan card, two operation rows (“Análisis de documentos”, “Generaciones de documentos”), count + thin bar each, explicit rule copy “Cada análisis consume 1 unidad. Cada generación consume 1 unidad.” plus reset date and limit behavior note. Keep dense, calm, implementation-ready spacing.

**Aspect ratio:** `16:9`

---

## 🧾 Prompt 8 — Formulario del caso nuevo *(alta palanca para handoff frontend)*

**Objetivo:** formulario dinámico por entidades con reglas de variación, validación y bloqueo de CTA.

**Prompt completo (EN):**

> Design “Nuevo caso” screen for template-ai from template “Contrato de locación”, desktop 1440px. Layout contract: left context rail (template info + completion), main dynamic form area with accordions, bottom action bar. Dynamic groups are examples only (Partes/Inmueble/Fechas), not fixed taxonomy. Visible field-row contract: label, helper text, required marker, current value control, validation slot, optional metadata line (including “Sin traza (agregado manualmente)” when applicable). Include explicit variation-rule UI examples: optional block, repeatable simple block (“Agregar firmante”), and boolean toggle with conditional children (“¿Incluir cláusula de garante?”). Interaction contract: collapsed section can show error badge count; clicking error summary anchors to first invalid field. CTA contract: “Generar documento” disabled until required fields are valid, with blocking reason copy. Edge contract: long labels, long helper text, and malformed user input should preserve alignment and row height rhythm.

**Aspect ratio:** `16:9`

---

## 👁️ Prompt 9 — Vista previa + edición final

**Objetivo:** control editorial final con edición paragraph-level y exportación clara.

**Prompt completo (EN):**

> Create “Vista previa final — Contrato de locación” screen for template-ai, desktop 1440px. Layout contract: main legal document viewer (serif, readable but dense), right validation/export sidebar, persistent top helper line. Paragraph interaction contract: each paragraph reveals edit affordance on hover; click enters inline edit mode for that paragraph only; no rich-text toolbar. Sidebar contract: verification checklist, export module with “Descargar PDF” and “Descargar DOCX”, and legal disclaimer. Include edge state for long paragraphs and a pending-export inline state placeholder that does not collapse layout.

**Aspect ratio:** `16:9`

---

## 📊 Prompt 10 — Plan y uso *(alta palanca de confianza y límites)*

**Objetivo:** comunicar límites de forma predecible, sin upsell ni marketing.

**Prompt completo (EN):**

> Design “Plan y uso” screen for template-ai with strict plain-language usage transparency. Desktop 1440px. Single plan card “Plan único”. For each operation row (“Análisis de documentos”, “Generaciones de documentos”), show: count text, thin usage bar, and contextual message by threshold (normal / near limit / limit reached). Add mandatory explanatory block “¿Qué pasa si llego al límite?” with bullets for blocked actions vs still available actions. Include reset date and “Ver historial de uso” link. No upgrade CTA, no pricing upsell, no marketing copy.

**Aspect ratio:** `16:9`

---

## 🌱 Prompt 11 — Bienvenida / Biblioteca vacía (primera vez)

**Objetivo:** onboarding breve y realista.

**Prompt completo (EN):**

> Create first-time empty state for template-ai with title “Bienvenido a template-ai”. Show 3-step strip (subir contrato, revisar detecciones, guardar y reutilizar), recommendation card for better file quality, CTA “Crear mi primera plantilla”, secondary “Ver un ejemplo”, and trust note “Nada se guarda sin tu aprobación”. Calm, professional, non-marketing.

**Aspect ratio:** `16:9`

---

## 🚫 Prompt 12 — Documento no apto / análisis fallido

**Objetivo:** fallback honesto, respetuoso y accionable.

**Prompt completo (EN):**

> Design recoverable failure screen titled “No pudimos analizar este archivo”. Include short reason rows (non-selectable text, low resolution, unrecognizable structure), “Qué podés hacer ahora” action panel (Subir otro archivo / Reintentar / Volver), and practical quality tip card. Amber warning style, no blame, no drama.

**Aspect ratio:** `16:9`

---

## ⛔ Prompt 13 — Límite alcanzado

**Objetivo:** bloqueo contextual firme, sin romper acceso general.

**Prompt completo (EN):**

> Create limit-reached state shown as inline banner plus blocking modal. Banner message: “Alcanzaste el límite de análisis de tu plan este mes.” Modal headline “Acción no disponible”, explicit reset-date explanation, and “Lo que sí podés hacer ahora” list. Actions: “Ver mi uso” and “Entendido”. No upsell elements.

**Aspect ratio:** `16:9`

---

## 🔐 Prompt 14 — Cómo tratamos tus documentos

**Objetivo:** confianza operativa con estructura tipo informe.

**Prompt completo (EN):**

> Design “Cómo tratamos tus documentos” as a formal trust report screen (not FAQ). Sections: Qué guardamos, Qué no guardamos, Retención y borrado, Cómo borrar tu contenido, Actividad reciente. Make soft delete vs physical purge in 30 days explicit, include deletion traceability example row, and keep accountable non-marketing tone.

**Aspect ratio:** `16:9`

---

## ⏳ Prompt 15 — Estado de análisis en curso (loading / skeleton)

**Objetivo:** loading realista sin sensación de congelamiento.

**Prompt completo (EN):**

> Create dedicated loading-state screen “Analizando tu contrato” with same shell. Show stepper in en_proceso, skeleton placeholders for future document and entity list, and explicit fallback clause to fail panel with reason + required action when state changes to fallido.

**Aspect ratio:** `16:9`

---

## ⚠️ Prompt 16 — Revisión del template con baja confianza activa *(variante crítica)*

**Objetivo:** reforzar resolución de BAJA confianza sin romper consistencia con la pantalla base.

**Prompt completo (EN):**

> Create a strict low-confidence variant of the template review screen for template-ai. Keep exactly the same shell and core regions as the base review screen to maximize component reuse. Add a high-priority right-panel section “Revisión prioritaria” with BAJA rows pinned first. Each BAJA row visible contract: field label, short uncertainty reason, trace badge, action “Revisar ahora”, and explicit resolution state (pending/resolved/accepted). Include at least one manual field with “Sin traza (agregado manualmente)”. Bottom CTA “Confirmar estructura” remains disabled until all BAJA rows move out of pending. Show disabled-state helper copy listing pending count.

**Aspect ratio:** `16:9`

---

## 🧪 Prompt 17 — Formulario incompleto con errores de validación

**Objetivo:** mostrar bloqueo de generación con guía precisa para corregir.

**Prompt completo (EN):**

> Design validation-error state for “Nuevo caso” form. Add top error summary bar with anchor links, invalid required fields with compact error messages, collapsed accordion with pending badge, and blocked/disabled “Generar documento” with reason copy. Keep visual calm: precise guidance, not alarmist red overload.

**Aspect ratio:** `16:9`

---

## ✅ Prompt 18 — Plantilla guardada con éxito

**Objetivo:** transición post-guardado sobria y útil.

**Prompt completo (EN):**

> Create restrained success screen “Plantilla guardada” with compact confirmation card (template name, VALIDADA status, reuse summary), next-steps info block, actions “Ir a mi biblioteca” and “Generar un documento con esta plantilla”, plus trust-link footer. No celebratory SaaS patterns.

**Aspect ratio:** `16:9`

---

## 🗂️ Prompt 19 — Biblioteca vacía después de limpiar todo

**Objetivo:** estado vacío post-uso (no onboarding).

**Prompt completo (EN):**

> Design post-cleanup empty library state (not first-time). Message: “No tenés plantillas activas en este momento.” Provide actions “Crear plantilla” and “Ver archivadas”, and keep right usage card visible with neutral note that plan remains available.

**Aspect ratio:** `16:9`

---

## 🗑️ Prompt 20 — Confirmación de borrado / acción destructiva

**Objetivo:** acción sensible explícita, sin dramatización.

**Prompt completo (EN):**

> Create destructive confirmation modal titled “Confirmar eliminación” with explicit scope, optional checkboxes (delete source file / generated docs), mandatory retention note (immediate UI removal + physical purge in 30 days), and traceability line. Buttons: “Eliminar” (destructive) and “Cancelar”.

**Aspect ratio:** `16:9`

---

## 📥 Prompt 21 — Descarga en progreso / exportación en curso

**Objetivo:** evitar incertidumbre entre clic y archivo final.

**Prompt completo (EN):**

> Design export-in-progress state on top of final preview screen. Show compact inline panel “Preparando tu PDF/DOCX”, thin progress indicator, short wait copy, and disable repeated same-format export clicks while preserving layout stability.

**Aspect ratio:** `16:9`

---

## 🔁 Follow-up prompts v1.4 (iteración de calidad)

Usar después de elegir una variante base para forzar consistencia reusable.

### 1) Layout/spec hardening
- “Keep exactly the same app shell and spacing rhythm; only refine content density inside the main region.”
- “Lock the region proportions and align all interactive controls to a strict column grid.”
- “Preserve component positions while improving readability of long legal labels.”

### 2) Data-contract clarity
- “Make the visible data contract explicit in every field/table row; avoid decorative placeholders.”
- “Show one realistic overflow case and one empty case without breaking alignment.”

### 3) Interaction/state fidelity
- “Increase distinction between hover, selected, focus, disabled, and blocked states without increasing visual noise.”
- “For every disabled primary CTA, show exact reason microcopy near the action.”
- “Emphasize BAJA confidence with shape/weight treatment that still works in grayscale.”

### 4) Reuse/front-end handoff
- “Make this screen look like it is built from reusable components, not unique one-off cards.”
- “Unify badges, row actions, and status chips with consistent sizing and spacing tokens across regions.”
- “Reduce style entropy: fewer visual patterns, stronger component repeatability.”

---

## ✅ Orden recomendado para explorar

1. **Prompt 2** — Revisión del template (base crítica)
2. **Prompt 16** — Variante BAJA confianza (misma arquitectura)
3. **Prompt 1** — Visual system (con pantalla crítica ya definida)
4. **Prompt 8 + 17** — Formulario normal + validación
5. **Prompt 7 + 19 + 20** — Biblioteca + vacío post-uso + destructivo
6. **Prompt 9 + 21** — Vista final + export en curso
7. **Prompt 4 + 15 + 5 + 6 + 18** — Flujo de creación completo
8. **Prompt 10 + 13** — Plan y límites
9. **Prompt 12 + 14** — Fallback + confianza
10. **Prompt 3 + 11** — Home + primera vez

---

*template-ai MVP — Design Prompt Pack for Nano Banana Pro*  
*v1.4 — rendering contract + reusable component fidelity + stronger frontend handoff*
