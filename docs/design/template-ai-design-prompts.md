# template-ai — Design Prompts (Stitch)

**Versión:** 2.0  
**Fecha:** Mayo 2026  
**Herramienta:** Google Stitch (figaro_agent / HatterAgent)  
**Proyecto Stitch:** `13244395666194572658`  
**Design System:** `assets/5621834681417054068` ("template-ai — Editorial Legal")

---

## 🎯 Objetivo

Este documento contiene los prompts optimizados para **Google Stitch** usados para generar los 21 mockups del MVP de **template-ai**. Reemplaza al pack original v1.4 diseñado para Google Flow / Nano Banana Pro.

Dirección de producto:

- serio, legal, calmado, accountable
- desktop-first
- revisión humana obligatoria
- límites y fallbacks honestos
- sin estética startup-consumer

---

## 🎨 Design System

Stitch maneja los tokens visuales (colores, tipografía, redondez) vía el design system del proyecto. **Los prompts NO incluyen colores, fuentes ni tokens.** Solo estructura, layout, contenido y estados.

| Token         | Valor               |
| ------------- | ------------------- |
| Color mode    | `LIGHT`             |
| Color variant | `NEUTRAL`           |
| Primary       | `#3d6b8f`           |
| Headline font | `LITERATA`          |
| Body font     | `SOURCE_SERIF_FOUR` |
| Label font    | `INTER`             |
| Roundness     | `ROUND_FOUR`        |

---

## 🔩 Reglas de Stitch prompting

1. **NO incluir colores, fuentes ni tokens** — el design system los aplica automáticamente.
2. **Foco en estructura**: layout, proporciones, contratos de datos visibles, estados.
3. **Variantes como `edit_screens`**: partir de una pantalla base existente para maximizar reutilización.
4. **Modelos**: `GEMINI_3_FLASH` para primeras generaciones, default (HatterAgent/figaro_agent) para ediciones.
5. **Siempre incluir `deviceType: DESKTOP` y `designSystem` ID**.

---

## ✅ Orden de generación seguido

```
P2  → P16           Revisión del template (base + variante BAJA confianza)
P8  → P17           Formulario dinámico (normal + errores de validación)
P3  · P9  · P4      Home · Vista previa · Subida
P10 · P12 · P11     Plan y uso · Fallback · Bienvenida
P13                 Límite alcanzado (edit P10)
P21 · P18 · P14     Export · Guardado éxito · Cómo tratamos
P20 · P6            Confirmar elim. · Guardar plantilla
P5                  Análisis del documento (edit P4)
P7                  Biblioteca (7 intentos — el más problemático)
P15                 Loading skeleton (edit P5)
P19                 Biblioteca vacía (edit P7)
```

---

## 🧩 Prompt 2 — Revisión del template

**Asset:** `.stitch/designs/p2-human-review-v1.html` (v1), `p2-human-review-v2.html` (v2 refinada)

```
Create the core template review screen for template-ai (mandatory human review gate).
Desktop, split layout: A) left document viewer 62%, B) right review panel 38%,
C) persistent bottom action bar. Region A: original legal document in serif,
highlighted variable spans, click-to-focus interaction. Region B title:
"Entidades y datos detectados". Dynamic entity groups with field rows showing:
label, required marker, confidence (ALTA/BAJA), trace state, variation badge,
actions. Trace contract: detected → "Ver origen", manual → "Sin traza (agregado
manualmente)". Include empty group state, overflow with sticky headers,
prioritized "Revisión prioritaria" section with BAJA rows first, "Dudas del
análisis" cards with yes/no disambiguation. Bottom bar: "Revisión humana
obligatoria", CTA "Confirmar estructura" disabled until all BAJA resolved,
secondary "Seguir revisando". Show hover, selected, disabled states with
microcopy. Professional calm editorial tone.
```

---

## ⚠️ Prompt 16 — Revisión con baja confianza activa (edit P2)

**Asset:** `.stitch/designs/p16-low-confidence-review.html`

```
Transform into strict low-confidence review variant. Keep same shell and core
regions as base review screen. Enhance "Revisión prioritaria" section with
explicit resolution state badges: "Pendiente" (amber outline), "Resuelta" (green
check), "Aceptada" (gray). Each BAJA row: field label, short uncertainty reason,
trace badge, "Revisar ahora" action. Include at least one manual field with
"Sin traza (agregado manualmente)". Resolved row shows reduced opacity and
strikethrough. Bottom CTA "Confirmar estructura" disabled until all BAJA rows
move out of pending. Show disabled-state helper copy with pending count.
```

---

## 🧾 Prompt 8 — Formulario del caso nuevo

**Asset:** `.stitch/designs/p8-nuevo-caso.html`

```
Create "Nuevo caso" form screen from template "Contrato de locación". Desktop
with app shell. Layout: narrow left context rail (template info + completion
tracker "Progreso: 8/11"), main dynamic form area with accordions, sticky bottom
action bar. Dynamic groups are examples only (Partes, Inmueble, Fechas). Field
row contract: label, required asterisk, input control, validation slot, metadata
line with trace info. Variation rules: optional block ("¿Incluir cláusula de
garante?" with conditional children), repeatable block ("Agregar firmante" adds
name+DNI+role rows), boolean toggle. Collapsed accordion shows amber error
badge. Bottom CTA "Generar documento" disabled with reason microcopy:
"Completá los 3 campos obligatorios pendientes antes de generar". "Guardar
borrador" remains active. Show validation error on one field with red border
and compact error message. Professional calm editorial.
```

---

## 🧪 Prompt 17 — Errores de validación (edit P8)

**Asset:** `.stitch/designs/p17-validation-errors.html`

```
Transform into validation-error state. Add compact error summary bar at top
with amber background: "Hay 4 campos que requieren tu atención" with numbered
anchor links. Validation errors: "Dirección completa" (required), "Fecha de
inicio" (invalid format), "Duración del contrato" (must be > 0), "Nombre del
Garante" (conditional required). Collapsed "Fechas" accordion with prominent
error badge "3 errores". Bottom CTA disabled with microcopy: "Corregí los 4
errores antes de generar el documento". Calm amber/light warning colors,
no red backgrounds or alarmist overload.
```

---

## 🎨 Prompt 3 — Inicio / Escritorio de trabajo

**Asset:** `.stitch/designs/p3-inicio.html`

```
Create "Inicio" home workspace. Desktop with app shell, sidebar (Inicio active).
Compact greeting header. Two action cards side by side: "Crear nueva plantilla"
(subtitle + primary "Comenzar") and "Generar documento" (subtitle +
"Seleccionar plantilla"). Dense "Plantillas recientes" list with 4 rows:
Nombre, Estado chip, Último uso, quick action on hover. Right plan snippet card:
"Plan único — 8 análisis disponibles este mes" with thin usage bar and
"Ver plan completo" link. Low noise, high structure, no hero metrics or charts.
Professional calm editorial.
```

---

## 👁️ Prompt 9 — Vista previa + edición final

**Asset:** `.stitch/designs/p9-vista-previa.html`

```
Create "Vista previa final — Contrato de locación". Desktop with shell. Layout:
main legal document viewer (serif, dense), right validation/export sidebar,
persistent top helper line. Document: full contract text in serif, paragraph-level.
Each paragraph reveals edit icon on hover; one paragraph shown in inline edit
mode with subtle border and Save/Cancel buttons. Sidebar: verification checklist
with 3 green checkmarks (Estructura, Datos, Fechas), export module with
"Descargar PDF" (primary) and "Descargar DOCX", legal disclaimer. Top helper:
"Revisá el documento final antes de exportar. Podés editar cualquier párrafo."
Professional calm editorial, warm off-white sidebar background.
```

---

## 📤 Prompt 4 — Subida de documento

**Asset:** `.stitch/designs/p4-subida-documento.html`

```
Create "Crear plantilla — paso 1 de 3" upload screen. Desktop with shell.
Layout: central dropzone, right guidance panel. Dropzone: large dashed-border
area with "Arrastrá tu archivo aquí o hacé clic para buscar", format badges
(PDF/DOCX/JPG). Show uploaded state: filename "CONTRATO_ARRENDAMIENTO_V2.pdf",
file size, green "Listo" status chip. Guidance panel: file quality tips in
Spanish (texto seleccionable, evitar escaneados, máximo 25MB), trust link
"Cómo tratamos tus documentos". Bottom non-dismissible notice: "Vas a revisar
todo lo que detectamos antes de guardar." CTA "Continuar al análisis" enabled,
"Cancelar" secondary. Professional calm editorial.
```

---

## 🔎 Prompt 5 — Análisis del documento (edit P4)

**Asset:** `.stitch/designs/p5-analisis-documento.html`

```
Transform into "Analizando tu contrato" analysis progress screen. Keep shell.
LEFT: vertical stepper with 4 steps (Validando archivo, Extrayendo texto,
Detectando estructura, Identificando datos del caso). Show first 2 as
completado (green check), third as en proceso (spinner), fourth as pendiente
(gray). MAIN: skeleton placeholder blocks (gray pulse rectangles) for document
preview and entity list. COMPLETION PREVIEW: small confidence summary card
"ALTA: 8 campos — BAJA: 3 campos". BOTTOM microcopy: "Si algo no se puede
analizar con claridad, te lo decimos antes de continuar." Professional calm
editorial.
```

---

## 💾 Prompt 6 — Guardar plantilla (edit P8)

**Asset:** `.stitch/designs/p6-guardar-plantilla.html`

```
Transform into "Guardar plantilla" save screen. Summary card:
"CONTRATO_ARRENDAMIENTO_V2.pdf — 11 campos, 3 BAJA revisados manualmente,
Revisión completada". Form: required "Nombre de la plantilla" (pre-filled
"Contrato de Arrendamiento"), optional "Descripción breve" (pre-filled).
Status badge VALIDADA with green check and explanation. Primary CTA
"Guardar en mi biblioteca" (enabled), secondary "Seguir editando" (outline).
Keep left context rail. Professional calm editorial.
```

---

## 📚 Prompt 7 — Biblioteca personal

**Asset:** `.stitch/designs/p7-biblioteca.html`

```
Create "Biblioteca" screen. Desktop with app shell, sidebar (Biblioteca active).
Layout: filter toolbar (search + status dropdown BORRADOR/VALIDADA/ARCHIVADA +
type filter), dense data table, right plan usage panel. Table: 5 rows, columns
Nombre, Estado chip, Tipo, Último uso, Acciones (icons on hover). Sticky header
with sort on Nombre. Plan panel: two usage bars (Análisis 3/8, Generaciones
1/8), rule text "Cada análisis consume 1 unidad. Cada generación consume 1
unidad.", reset date, "Ver historial de uso" link. Professional calm editorial.
```

---

## 📊 Prompt 10 — Plan y uso

**Asset:** `.stitch/designs/p10-plan-uso.html`

```
Create "Plan y uso" screen. Desktop with shell. Single plan card "Plan único".
Two operation rows: "Análisis de documentos" (3 de 8, bar ~40%, "Normal — te
quedan 5"), "Generaciones de documentos" (1 de 8, bar ~12%, "Normal — te quedan
7"). Explanatory block "¿Qué pasa si llego al límite?" with bullets: no new
analysis, but editing/generating/library access remain. Reset date
"1 de junio de 2026". "Ver historial de uso" link. NO upgrade CTA, no pricing,
no marketing. Professional calm transparent tone.
```

---

## 🌱 Prompt 11 — Bienvenida / Biblioteca vacía (primera vez)

**Asset:** `.stitch/designs/p11-bienvenida.html`

```
Create "Bienvenido a template-ai" first-time onboarding. Desktop with shell,
sidebar (Inicio active). 3-step onboarding strip: 1) "Subí tu contrato" (cargá
PDF/DOCX/JPG), 2) "Revisá las detecciones" (IA detecta, vos validás),
3) "Guardá y reutilizá" (creá documentos desde plantillas). Recommendation card:
usá texto digital, secciones bien definidas. Primary CTA "Crear mi primera
plantilla", secondary "Ver un ejemplo de plantilla". Trust note: "Nada se
guarda sin tu aprobación. Revisás todo antes de confirmar." Calm, professional,
non-marketing.
```

---

## 🚫 Prompt 12 — Documento no apto / análisis fallido

**Asset:** `.stitch/designs/p12-no-apto.html`

```
Create "No pudimos analizar este archivo" failure screen. Failure reason rows:
texto no seleccionable (imagen escaneada), resolución baja, estructura no
reconocida. Action panel "¿Qué podés hacer ahora?" with "Subir otro archivo"
(primary), "Reintentar con este archivo" (secondary), "Volver al inicio" (link).
Practical tip card: usar PDF con texto digital, legible y nítido, evitar
documentos con contraseña. Amber warning style, no blame, respectful.
Professional editorial.
```

---

## ⛔ Prompt 13 — Límite alcanzado (edit P10)

**Asset:** `.stitch/designs/p13-limite-alcanzado.html`

```
Transform into limit-reached state. Add prominent amber warning banner:
"Alcanzaste el límite de análisis de tu plan este mes." Analysis bar at 100%
(8/8) in red/warning color. Keep generaciones bar normal. Explanatory card
"Acción no disponible" with reset date, "Lo que sí podés hacer ahora" list
(ver plantillas, generar docs, descargar archivos). Buttons: "Ver mi uso" and
"Entendido". No upsell, no upgrade. Professional calm editorial.
```

---

## 🔐 Prompt 14 — Cómo tratamos tus documentos (edit P10)

**Asset:** `.stitch/designs/p14-como-tratamos.html`

```
Transform into formal trust report "Cómo tratamos tus documentos" (not FAQ).
Sections: 1) "Qué guardamos" (estructura de plantilla, nombres de entidades,
mapeo de campos — no contenido original), 2) "Qué no guardamos" (archivos
originales post-análisis, datos personales no mapeados, datos temporales
24h), 3) "Retención y borrado" (soft delete inmediato + purga física 30 días),
4) "Cómo borrar tu contenido" (pasos accionables), 5) "Actividad reciente"
(tabla de trazabilidad con fecha, acción, detalle, estado). Accountable,
non-marketing. Professional calm editorial.
```

---

## ⏳ Prompt 15 — Loading / Skeleton (edit P5)

**Asset:** `.stitch/designs/p15-loading-skeleton.html`

```
Transform into dedicated loading/skeleton state "Analizando tu contrato". Stepper
step 3 as en proceso (spinner). Replace all main content with ONLY skeleton
pulse blocks (gray rectangles). Add explicit fallback text: "Si el análisis
falla, verás el motivo exacto y qué hacer." Add fail panel placeholder:
"Si algo falla" with reason slot and "Reintentar" button area. Professional
calm editorial.
```

---

## ✅ Prompt 18 — Plantilla guardada con éxito (edit P11)

**Asset:** `.stitch/designs/p18-guardado-exito.html`

```
Transform into restrained success screen "Plantilla guardada". Compact
confirmation card: template name "Contrato de Arrendamiento", VALIDADA status
badge with green check, summary "11 campos detectados, 3 revisados manualmente,
estructura confirmada". Info block: "Ya podés usar esta plantilla para generar
documentos." Actions: "Ir a mi biblioteca" (primary), "Generar un documento con
esta plantilla" (secondary). Trust footer: "Podés revisar o editar la plantilla
cuando quieras desde tu biblioteca." No celebratory patterns.
```

---

## 🗂️ Prompt 19 — Biblioteca vacía post-uso (edit P7)

**Asset:** `.stitch/designs/p19-biblioteca-vacia.html`

```
Transform into empty-post-cleanup library state (not first-time onboarding).
Empty state with icon and text "No tenés plantillas activas en este momento."
Two actions: "Crear plantilla" (primary) and "Ver archivadas" (secondary).
Keep filter toolbar visible with "Sin resultados" indicator. Keep right plan
panel with neutral note "Tu plan sigue disponible." Professional calm editorial.
```

---

## 🗑️ Prompt 20 — Confirmación de borrado (edit P12)

**Asset:** `.stitch/designs/p20-confirmar-eliminacion.html`

```
Transform into destructive confirmation modal "Confirmar eliminación". Explicit
scope: "Vas a eliminar 'Contrato de Arrendamiento' de tu biblioteca." Optional
checkboxes: "Eliminar también el archivo fuente", "Eliminar documentos generados
con esta plantilla". Mandatory amber retention note: retiro inmediato + purga
física 30 días + restauración posible durante ese período. Traceability line:
"Actividad registrada para tu trazabilidad." Buttons: "Eliminar" (destructive
red outline) and "Cancelar" (neutral). No drama, professional tone.
```

---

## 📥 Prompt 21 — Export en curso (edit P9)

**Asset:** `.stitch/designs/p21-export-en-curso.html`

```
Transform into export-in-progress overlay on final preview screen. Keep document
viewer and sidebar intact. Add compact inline panel at top: "Preparando tu
descarga" with thin progress indicator bar and wait copy "Estamos generando tu
archivo. Esto puede tardar unos segundos." Disable PDF/DOCX download buttons
(grayed out with "Generando..." label). Keep layout stable, no layout shift.
Professional calm editorial.
```

---

## 📁 Assets

Todos los archivos en `.stitch/designs/`. Screenshots solo disponibles para las pantallas que tuvieron tiempo de cacheo en CDN (marcadas con 📸).

| Prompt | HTML                             |
| ------ | -------------------------------- |
| P2 v1  | `p2-human-review-v1.html`        |
| P2 v2  | `p2-human-review-v2.html`        |
| P16    | `p16-low-confidence-review.html` |
| P8     | `p8-nuevo-caso.html`             |
| P17    | `p17-validation-errors.html`     |
| P3     | `p3-inicio.html`                 |
| P9     | `p9-vista-previa.html`           |
| P4     | `p4-subida-documento.html`       |
| P10    | `p10-plan-uso.html`              |
| P12    | `p12-no-apto.html`               |
| P11    | `p11-bienvenida.html`            |
| P13    | `p13-limite-alcanzado.html`      |
| P21    | `p21-export-en-curso.html`       |
| P18    | `p18-guardado-exito.html`        |
| P14    | `p14-como-tratamos.html`         |
| P20    | `p20-confirmar-eliminacion.html` |
| P6     | `p6-guardar-plantilla.html`      |
| P5     | `p5-analisis-documento.html`     |
| P7     | `p7-biblioteca.html`             |
| P15    | `p15-loading-skeleton.html`      |
| P19    | `p19-biblioteca-vacia.html`      |

Metadatos completos con Stitch IDs, modelos y dependencias en `.stitch/metadata.json`.

---

_template-ai MVP — Design Prompt Pack for Google Stitch_  
_v2.0 — prompts optimizados, assets renombrados, Google Flow descartado_
