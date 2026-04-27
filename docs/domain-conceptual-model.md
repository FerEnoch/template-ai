# Modelo conceptual de dominio — MVP `template-ai`

## Objetivo del modelo
Definir un modelo de dominio conceptual (no técnico/SQL) para el MVP orientado a abogados que crean plantillas reutilizables desde documentos legales existentes, con revisión humana obligatoria, trazabilidad de origen y generación posterior de documentos por caso.

## Áreas de dominio (bounded contexts) para MVP

1. **Identidad y acceso**
   - Inicio de sesión del usuario (Google OAuth en MVP).
   - Estado de suscripción y disponibilidad de uso.

2. **Ingesta y análisis documental**
   - Carga de archivo, validación de aptitud, extracción de texto/estructura, y detección de datos variables.

3. **Diseño y validación de plantilla**
   - Revisión humana del resultado detectado.
   - Confirmación de estructura fija, campos variables, entidades y reglas simples.

4. **Biblioteca de plantillas**
   - Gestión de plantillas personales (borrador, validada, archivada).

5. **Generación de documento por caso**
   - Captura de datos del caso en formulario derivado de plantilla.
   - Ensamblado de documento final + edición textual final + exportación.

6. **Uso, trazabilidad y cumplimiento básico**
   - Eventos de actividad, señales de confianza, retención/borrado y auditabilidad básica para el usuario.

## Entidades / conceptos principales

- **Usuario**
  - Profesional que usa la plataforma y posee biblioteca personal de plantillas y documentos generados.

- **Suscripción**
  - Estado de acceso al servicio y política de uso incluida para el MVP (plan único).

- **Uso (consumo)**
  - Registro de operaciones relevantes para límites visibles.
  - En MVP, la unidad de consumo es fija: **1 unidad por análisis de documento** y **1 unidad por generación de documento**.

- **Documento fuente**
  - Archivo subido por el usuario como base de análisis.
  - Puede tener estado de aptitud para el flujo (apto/no apto).

- **Extracción**
  - Resultado de obtener texto/estructura y señales de confianza desde documento fuente.

- **Detección de template**
  - Propuesta inicial del sistema sobre partes fijas, variables, entidades y ambigüedades.

- **Plantilla**
  - Estructura reusable validada por humano: texto fijo + campos variables + reglas simples.

- **Campo variable (dato del caso)**
  - Dato que cambia entre casos (nombre, fecha, monto, etc.).
  - Incluye obligatoriedad y agrupación por entidad.

- **Entidad de negocio (agrupadora)**
  - Agrupa campos de una misma “cosa” del mundo legal (parte, inmueble, expediente, juzgado, etc.).

- **Regla simple de variación**
  - Comportamiento condicional acotado de MVP (bloque opcional, repetible simple, sí/no).

- **Traza de origen**
  - Vínculo entre campo detectado y fragmento del documento fuente que justifica su detección.

- **Caso**
  - Instancia concreta de completado de una plantilla para producir un documento nuevo.

- **Documento generado**
  - Resultado final de aplicar datos del caso a una plantilla validada, con posibilidad de edición textual previa a exportación.

- **Exportación**
  - Artefacto entregable del documento generado (MVP: PDF / DOCX según decisiones vigentes del PRD).

- **Evento de actividad / auditoría básica**
  - Hechos relevantes para confianza y trazabilidad (subida, validación, guardado, generación, advertencias de baja confianza, borrado).

## Relaciones clave

- Un **Usuario** tiene una **Suscripción** activa/inactiva y múltiples registros de **Uso**.
- Un **Usuario** sube múltiples **Documentos fuente**.
- Un **Documento fuente** puede tener una o más **Extracciones** (reintentos/versiones de análisis).
- Una **Extracción** deriva en una **Detección de template**.
- Una **Detección de template** puede convertirse en una **Plantilla** tras revisión humana.
- Una **Plantilla** pertenece a un **Usuario** y contiene múltiples **Campos variables**, **Entidades** y **Reglas simples**.
- Cada **Campo variable** puede tener una o más **Trazas de origen** hacia fragmentos del documento fuente.
- Una **Plantilla** genera múltiples **Casos**.
- Un **Caso** produce uno o más **Documentos generados** (por regeneración/ajuste).
- Un **Documento generado** puede tener múltiples **Exportaciones**.
- Todas las acciones relevantes generan **Eventos de actividad**.

## Cardinalidades y ownership explícitos (para bajar a relacional sin ambigüedad)

- **Usuario 1:N Documento fuente**
  - Todo documento fuente tiene un único propietario.
- **Usuario 1:N Plantilla**
  - La biblioteca del MVP es estrictamente personal.
- **Documento fuente 1:N Extracción**
  - Permite reintentos y reruns sin perder historial.
- **Extracción 1:1 Detección de template (MVP)**
  - Cada ejecución de análisis produce una propuesta coherente.
- **Plantilla 1:N Campo variable**
  - Los campos son parte interna de una plantilla concreta.
- **Plantilla 1:N Entidad agrupadora**
  - Una entidad no existe fuera de su plantilla en MVP.
- **Campo variable 0..N Traza de origen**
  - Puede no haber traza en campos agregados manualmente por el usuario.
- **Plantilla 1:N Caso**
  - Cada caso pertenece a una plantilla y a su propietario.
- **Caso 1:N Documento generado**
  - Se admiten regeneraciones o ajustes sucesivos.
- **Documento generado 1:N Exportación**
  - Un mismo resultado puede exportarse más de una vez/formato.
- **Usuario 1:N Evento de actividad**
  - Todo evento tiene actor (usuario o sistema), recurso y momento.

## Hitos de ciclo de vida con valor de negocio

Además de estados, el dominio define hitos que impactan reglas y auditoría:

- **Plantilla validada por humano**
  - habilita su uso en generación; antes de ese hito no debe usarse para casos productivos.
- **Caso listo para generar**
  - implica que los campos obligatorios están completos.
- **Documento finalizado**
  - congela una versión textual revisada por el usuario previa exportación.
- **Borrado solicitado/ejecutado**
  - distingue intención del usuario de la eliminación efectiva de artefactos.

## Frontera entre dato fuente de verdad y dato derivado

- **Fuente de verdad de negocio**: PostgreSQL (usuarios, plantillas, casos, estados, trazas, eventos).
- **Binarios/artefactos pesados**: object storage externo (archivo original y exportaciones).
- **Dato derivado volátil**: resultados intermedios de proveedor (prompts/respuestas crudas) se consideran operacionales; se persisten solo si aportan trazabilidad, debugging o cumplimiento.

## Modelo conceptual de errores y confianza

Para sostener decisiones operativas y UX honesta, cada proceso relevante del dominio debe poder expresar:

- **estado de ejecución** (`pendiente`, `en_proceso`, `completado`, `fallido`);
- **motivo de fallo clasificable** (entrada no apta, timeout proveedor, validación incompleta, límite alcanzado, etc.);
- **nivel de confianza** (alto/bajo) cuando aplica detección;
- **acción requerida al usuario** (reintentar, corregir, validar manualmente, esperar renovación de límite).

No es solo telemetría técnica: es parte del lenguaje de negocio del MVP.

## Ciclos de vida / estados sugeridos

- **Documento fuente**
  - `subido` → `en_analisis` → (`apto` | `no_apto`) → (`analizado` | `fallido`).

- **Detección / extracción**
  - `pendiente` → `completada` → (`alta_confianza` | `baja_confianza`).

- **Plantilla**
  - `borrador` → `validada` → `archivada`.

- **Caso**
  - `en_carga` → `listo_para_generar` → `generado`.

- **Documento generado**
  - `borrador_editable` → `finalizado` → `exportado`.

- **Suscripción/uso**
  - `activa` / `limitada` / `sin_acceso` según política del plan y consumo.

## Reglas de negocio / invariantes

1. **Revisión humana obligatoria**: una plantilla no puede pasar a `validada` sin confirmación explícita del usuario.
2. **No generación incompleta**: no se genera documento final si faltan campos obligatorios del caso.
3. **Baja confianza visible**: si la detección es de baja confianza, debe quedar señalada y exigir revisión reforzada.
4. **Trazabilidad mínima por campo relevante**: los campos detectados deben poder vincularse a su origen documental.
5. **Aislamiento por usuario**: biblioteca y artefactos de un usuario no son visibles para otro en MVP.
6. **Límite de uso entendible**: al alcanzar límite, se bloquean nuevas operaciones de análisis/generación según política, pero se preserva acceso a biblioteca/historial según PRD.
7. **Borrado accionable por usuario**: debe existir acción explícita para eliminar plantilla/documento/archivo y su alcance asociado.
8. **Confidencialidad por defecto**: los datos se usan para prestar el servicio acordado; no se expone contenido entre usuarios.
9. **Propiedad consistente**: plantilla, caso y documento generado deben pertenecer al mismo usuario propietario.
10. **Integridad de regeneración**: cada documento generado debe quedar asociado al caso y plantilla usados en su creación.
11. **Borrado trazable**: toda eliminación relevante debe dejar evidencia de quién, cuándo y qué alcance tuvo.
12. **Secuencia de borrado obligatoria**: primero eliminación lógica; luego purga física diferida.
13. **Política de purga MVP**: la purga física ocurre a los **30 días** desde la eliminación lógica y debe registrar evento de purga.
14. **Sin versionado de plantilla en MVP**: cada plantilla se gestiona como recurso único editable dentro de su ciclo (`borrador`/`validada`/`archivada`).

## Notas explícitas clave del modelo

### Trazabilidad
- El modelo incluye `Traza de origen` como concepto de primer nivel para sostener confianza y revisión legal.
- No es opcional en términos de producto: debe poder mostrarse evidencia del origen de datos detectados.
- Granularidad mínima obligatoria en MVP: **página + texto de extracto**.
- Enriquecimiento opcional cuando esté disponible: offsets de caracteres, bounding box, metadatos de bloque estructural y tipo de fuente (`source_kind`).

### Human review
- La intervención humana no es fallback técnico; es parte del flujo obligatorio del negocio.
- La “aceptación de plantilla” es un hito de dominio, no solo de UI.

### Confidencialidad
- El dominio distingue claramente artefactos sensibles (documento fuente, extracción, plantilla, documento generado).
- El acceso y visibilidad deben ser privados por defecto por usuario.
- Se adopta defensa en profundidad desde MVP: aislamiento por ownership en aplicación + controles de fila en PostgreSQL (RLS) para tablas sensibles de propiedad de usuario.

### Retención y borrado
- Se modela retención por vínculo de artefactos (mientras exista plantilla/documento asociado) y borrado manual.
- El borrado debe quedar registrado como evento de actividad para auditabilidad básica.
- El dominio distingue artefacto `eliminado lógicamente` vs `purgado físicamente` para permitir ventanas operativas de consistencia y cumplimiento.
- Política cerrada MVP: purga física diferida a **30 días** desde la eliminación lógica, con evento explícito de purga.

### Fronteras anti-vendor-lock
- El dominio NO depende de proveedor específico de auth, storage, OCR o LLM.
- Esos servicios viven detrás de puertos de aplicación (interfaces), preservando lenguaje del dominio y capacidad de reemplazo.
- PostgreSQL mantiene el estado de dominio; storage externo conserva binarios/artefactos pesados.

## Decisiones cerradas para MVP (sin pendientes de diseño DB en este alcance)

1. Consumo: 1 unidad por análisis y 1 unidad por generación.
2. Borrado: soft delete primero + purga física diferida.
3. Purga física: 30 días tras borrado lógico + evento de purga obligatorio.
4. Versionado de plantilla: no se incorpora en MVP.
5. Aislamiento en DB: RLS habilitado tempranamente en tablas sensibles con políticas mínimas y prácticas.
6. Trazabilidad mínima: página + extracto; enriquecimientos opcionales cuando existan.
7. Fallas: código de falla textual en persistencia; catálogo canónico en backend.
