# Borrador de esquema PostgreSQL — MVP `template-ai`

## 1) Objetivos de diseño

1. **PostgreSQL como fuente de verdad del negocio**: usuarios, plantillas, casos, estados, trazabilidad y uso.
2. **Aislamiento estricto por usuario** (biblioteca personal).
3. **Integridad referencial fuerte** para evitar inconsistencias entre documento fuente, plantilla, caso y documento generado.
4. **Trazabilidad operativa y de confianza** (origen de campos, eventos relevantes, fallos).
5. **Retención/borrado modelados explícitamente** (soft delete + purga física).
6. **Abstracción de proveedores**: el dominio no depende de OpenRouter/Firebase, solo guarda referencias y metadatos neutrales.
7. **Pragmatismo MVP**: pocas tablas, bien acopladas al flujo real, sin sobre-ingeniería temprana.

### Nota operativa de entornos (obligatoria)
- Para evitar contaminación de datos y falsos positivos en pruebas, operar PostgreSQL con **aislamiento explícito por entorno**: dev, test y prod.
- En Docker, levantar instancias/volúmenes/bases separadas por entorno (vía perfiles/archivos `compose` o equivalente).
- Testing no debe reutilizar la base de desarrollo; idealmente usar DB efímera o base dedicada de test con ciclo de vida controlado por comandos reproducibles (Makefile).

---

## 2) Decisiones de modelado

### 2.1 Claves primarias
- **PK interna**: `BIGINT GENERATED ALWAYS AS IDENTITY` en tablas principales.
- **IDs públicos opcionales**: `public_id UUID` para recursos expuestos por API/UI (evita enumeración simple de IDs internos).

> Tradeoff: solo `BIGINT` simplifica; agregar `public_id` mejora opacidad externa con costo mínimo.

### 2.2 Enums/estados
- Para estados de negocio del MVP, usar **`TEXT + CHECK`** (más flexible que `ENUM` nativo ante cambios frecuentes).
- Reservar `ENUM` nativo para catálogos muy estables (si aparecen).

### 2.3 Fechas, dinero y texto
- Tiempos: `TIMESTAMPTZ`.
- Texto: `TEXT`.
- Consumo/cupos: `INTEGER/BIGINT` según volumen.

### 2.4 JSONB
- Usar `JSONB` solo para payloads semiestructurados (metadatos de proveedor, snapshot de estructura detectada).
- Entidades núcleo (plantillas, campos, casos, estados) **normalizadas**.

---

## 3) Áreas de dominio y tablas principales

## A. Identidad, acceso y plan

### `users`
**Propósito**: identidad del usuario (MVP Google OAuth).

Columnas clave:
- `id BIGINT PK`
- `public_id UUID UNIQUE`
- `email TEXT NOT NULL`
- `email_normalized TEXT NOT NULL` (lowercase)
- `display_name TEXT NOT NULL`
- `google_subject TEXT NOT NULL` (sub de OAuth)
- `created_at TIMESTAMPTZ NOT NULL`
- `updated_at TIMESTAMPTZ NOT NULL`
- `deleted_at TIMESTAMPTZ NULL`

Reglas:
- `UNIQUE (email_normalized)`
- `UNIQUE (google_subject)`

Índices:
- `INDEX (created_at)`
- `INDEX (deleted_at) WHERE deleted_at IS NOT NULL`

---

### `subscriptions`
**Propósito**: estado de acceso y ventana de vigencia del plan único.

Columnas clave:
- `id BIGINT PK`
- `user_id BIGINT NOT NULL FK -> users(id)`
- `status TEXT NOT NULL` CHECK in (`activa`,`limitada`,`sin_acceso`,`cancelada`)
- `plan_code TEXT NOT NULL` (ej. `mvp_unico`)
- `period_start TIMESTAMPTZ NOT NULL`
- `period_end TIMESTAMPTZ NOT NULL`
- `created_at TIMESTAMPTZ NOT NULL`
- `updated_at TIMESTAMPTZ NOT NULL`

Reglas:
- para MVP, **una suscripción vigente por usuario**:
  - `UNIQUE (user_id, period_start)`
  - validación de no superposición de períodos (deferida a app por MVP; posible EXCLUDE futuro).

Índices:
- `INDEX (user_id, status)`
- `INDEX (period_end)`

---

### `usage_ledger`
**Propósito**: registro auditable de consumo (análisis/generación).

Columnas clave:
- `id BIGINT PK`
- `user_id BIGINT NOT NULL FK -> users(id)`
- `subscription_id BIGINT NULL FK -> subscriptions(id)`
- `operation_type TEXT NOT NULL` CHECK in (`analisis_documento`,`generacion_documento`)
- `units INTEGER NOT NULL` CHECK (`units > 0`)
- `operation_ref_type TEXT NOT NULL` (ej. `document_analysis_job`, `generated_document`)
- `operation_ref_id BIGINT NOT NULL`
- `created_at TIMESTAMPTZ NOT NULL`

Reglas:
- inmutable (append-only lógico).
- unidad de consumo MVP cerrada: `units = 1` tanto para `analisis_documento` como para `generacion_documento`.
- mantener `units` por compatibilidad futura (sin ponderación en MVP).

Índices:
- `INDEX (user_id, created_at DESC)`
- `INDEX (subscription_id, created_at DESC)`
- `INDEX (operation_ref_type, operation_ref_id)`

---

## B. Ingesta y análisis documental

### `source_documents`
**Propósito**: documento subido por usuario + referencia a objeto binario.

Columnas clave:
- `id BIGINT PK`
- `public_id UUID UNIQUE`
- `user_id BIGINT NOT NULL FK -> users(id)`
- `filename_original TEXT NOT NULL`
- `mime_type TEXT NOT NULL`
- `size_bytes BIGINT NOT NULL CHECK (size_bytes > 0)`
- `storage_provider TEXT NOT NULL` (ej. `firebase_gcs`)
- `storage_object_key TEXT NOT NULL`
- `storage_bucket TEXT NOT NULL`
- `status TEXT NOT NULL` CHECK in (`subido`,`en_analisis`,`apto`,`no_apto`,`analizado`,`fallido`)
- `aptitude_reason_code TEXT NULL` (si `no_apto`)
- `uploaded_at TIMESTAMPTZ NOT NULL`
- `deleted_at TIMESTAMPTZ NULL`
- `purged_at TIMESTAMPTZ NULL`

Reglas:
- `UNIQUE (storage_provider, storage_bucket, storage_object_key)`
- si `purged_at IS NOT NULL` entonces `deleted_at IS NOT NULL` (CHECK).

Índices:
- `INDEX (user_id, uploaded_at DESC)`
- `INDEX (status, uploaded_at DESC)`
- `INDEX (deleted_at) WHERE deleted_at IS NOT NULL`

---

### `document_analysis_jobs`
**Propósito**: ejecuciones de extracción/detección por documento (reintentos/versiones).

Columnas clave:
- `id BIGINT PK`
- `source_document_id BIGINT NOT NULL FK -> source_documents(id)`
- `triggered_by_user_id BIGINT NULL FK -> users(id)`
- `provider_kind TEXT NOT NULL` CHECK in (`openrouter`,`otro`)
- `provider_model TEXT NULL`
- `status TEXT NOT NULL` CHECK in (`pendiente`,`en_proceso`,`completado`,`fallido`)
- `confidence_level TEXT NULL` CHECK in (`alta`,`baja`)
- `failure_code TEXT NULL`
- `failure_message TEXT NULL`
- `started_at TIMESTAMPTZ NULL`
- `finished_at TIMESTAMPTZ NULL`
- `created_at TIMESTAMPTZ NOT NULL`

Reglas:
- `finished_at >= started_at` cuando ambos existen.

Índices:
- `INDEX (source_document_id, created_at DESC)`
- `INDEX (status, created_at DESC)`
- `INDEX (provider_kind, created_at DESC)`

---

### `analysis_results`
**Propósito**: resultado estructurado de análisis para revisión humana.

Columnas clave:
- `id BIGINT PK`
- `analysis_job_id BIGINT NOT NULL UNIQUE FK -> document_analysis_jobs(id)`
- `extracted_text TEXT NULL`
- `structure_snapshot JSONB NOT NULL` (bloques/secciones detectadas)
- `detection_snapshot JSONB NOT NULL` (campos/entidades propuestos)
- `ambiguities_snapshot JSONB NOT NULL DEFAULT '[]'`
- `created_at TIMESTAMPTZ NOT NULL`

Índices:
- `GIN (structure_snapshot)` opcional (solo si se consulta)
- `GIN (detection_snapshot)` opcional

---

## C. Plantillas y validación humana

### `templates`
**Propósito**: plantilla reusable del usuario.

Columnas clave:
- `id BIGINT PK`
- `public_id UUID UNIQUE`
- `user_id BIGINT NOT NULL FK -> users(id)`
- `source_document_id BIGINT NULL FK -> source_documents(id)`
- `analysis_result_id BIGINT NULL FK -> analysis_results(id)`
- `name TEXT NOT NULL`
- `description TEXT NULL`
- `status TEXT NOT NULL` CHECK in (`borrador`,`validada`,`archivada`)
- `validated_at TIMESTAMPTZ NULL`
- `created_at TIMESTAMPTZ NOT NULL`
- `updated_at TIMESTAMPTZ NOT NULL`
- `deleted_at TIMESTAMPTZ NULL`

Reglas:
- `validated_at` obligatorio si `status = 'validada'`.
- `UNIQUE (user_id, name) WHERE deleted_at IS NULL` (evita duplicados activos en biblioteca).

Índices:
- `INDEX (user_id, status, updated_at DESC)`
- `INDEX (source_document_id)`

---

### `template_entities`
**Propósito**: agrupadores semánticos de campos dentro de una plantilla.

Columnas clave:
- `id BIGINT PK`
- `template_id BIGINT NOT NULL FK -> templates(id)`
- `name TEXT NOT NULL`
- `entity_type TEXT NULL` (ej. `parte`,`inmueble`,`expediente`)
- `display_order INTEGER NOT NULL CHECK (display_order >= 0)`

Reglas:
- `UNIQUE (template_id, name)`

Índices:
- `INDEX (template_id, display_order)`

---

### `template_fields`
**Propósito**: campos variables definidos/validados en plantilla.

Columnas clave:
- `id BIGINT PK`
- `template_id BIGINT NOT NULL FK -> templates(id)`
- `entity_id BIGINT NULL FK -> template_entities(id)`
- `field_key TEXT NOT NULL` (estable para render y mapeo)
- `label TEXT NOT NULL`
- `data_type TEXT NOT NULL` CHECK in (`texto`,`numero`,`fecha`,`booleano`)
- `is_required BOOLEAN NOT NULL DEFAULT false`
- `is_repeatable BOOLEAN NOT NULL DEFAULT false`
- `repeat_group_key TEXT NULL`
- `display_order INTEGER NOT NULL CHECK (display_order >= 0)`
- `created_from_detection BOOLEAN NOT NULL DEFAULT true`

Reglas:
- `UNIQUE (template_id, field_key)`
- si `entity_id` no es null, debe pertenecer a la misma plantilla (validación por trigger o app en MVP).

Índices:
- `INDEX (template_id, display_order)`
- `INDEX (entity_id, display_order)`

---

### `template_rules`
**Propósito**: reglas simples de variación de MVP.

Columnas clave:
- `id BIGINT PK`
- `template_id BIGINT NOT NULL FK -> templates(id)`
- `rule_type TEXT NOT NULL` CHECK in (`bloque_opcional`,`grupo_repetible`,`condicion_si_no`)
- `target_block_key TEXT NOT NULL`
- `condition_field_key TEXT NULL`
- `condition_operator TEXT NULL` CHECK in (`equals`,`not_equals`,`is_true`,`is_false`,`exists`)
- `condition_value_text TEXT NULL`
- `created_at TIMESTAMPTZ NOT NULL`

Índices:
- `INDEX (template_id, rule_type)`

---

### `field_source_traces`
**Propósito**: traza entre campo de plantilla y origen en documento fuente.

Columnas clave:
- `id BIGINT PK`
- `template_field_id BIGINT NOT NULL FK -> template_fields(id)`
- `source_document_id BIGINT NOT NULL FK -> source_documents(id)`
- `analysis_job_id BIGINT NULL FK -> document_analysis_jobs(id)`
- `excerpt_text TEXT NOT NULL`
- `locator_json JSONB NOT NULL` (mínimo obligatorio: `page`; opcional: bbox, offsets, bloque estructural, source_kind)
- `confidence_score NUMERIC(5,4) NULL CHECK (confidence_score >= 0 AND confidence_score <= 1)`
- `created_at TIMESTAMPTZ NOT NULL`

Reglas:
- un campo puede tener múltiples trazas.
- mínimo de trazabilidad MVP: `excerpt_text` + `locator_json.page`.

Índices:
- `INDEX (template_field_id)`
- `INDEX (source_document_id)`
- `GIN (locator_json)` opcional

---

## D. Casos y generación de documentos

### `cases`
**Propósito**: instancia de uso de plantilla para un caso concreto.

Columnas clave:
- `id BIGINT PK`
- `public_id UUID UNIQUE`
- `user_id BIGINT NOT NULL FK -> users(id)`
- `template_id BIGINT NOT NULL FK -> templates(id)`
- `name TEXT NOT NULL`
- `status TEXT NOT NULL` CHECK in (`en_carga`,`listo_para_generar`,`generado`)
- `created_at TIMESTAMPTZ NOT NULL`
- `updated_at TIMESTAMPTZ NOT NULL`
- `deleted_at TIMESTAMPTZ NULL`

Reglas:
- ownership consistente con plantilla (misma cuenta) validado por app/servicio de dominio.

Índices:
- `INDEX (user_id, updated_at DESC)`
- `INDEX (template_id, created_at DESC)`

---

### `case_field_values`
**Propósito**: valores concretos ingresados para cada campo del caso.

Columnas clave:
- `id BIGINT PK`
- `case_id BIGINT NOT NULL FK -> cases(id)`
- `template_field_id BIGINT NOT NULL FK -> template_fields(id)`
- `repeat_index INTEGER NOT NULL DEFAULT 0 CHECK (repeat_index >= 0)`
- `value_text TEXT NULL`
- `value_number NUMERIC(18,4) NULL`
- `value_date DATE NULL`
- `value_boolean BOOLEAN NULL`
- `created_at TIMESTAMPTZ NOT NULL`
- `updated_at TIMESTAMPTZ NOT NULL`

Reglas:
- `UNIQUE (case_id, template_field_id, repeat_index)`
- validación de tipo consistente (solo una columna de valor no-null según `data_type`) en app inicialmente; CHECK complejo diferido.

Índices:
- `INDEX (case_id)`
- `INDEX (template_field_id)`

---

### `generated_documents`
**Propósito**: resultados generados desde un caso (incluye edición final).

Columnas clave:
- `id BIGINT PK`
- `public_id UUID UNIQUE`
- `user_id BIGINT NOT NULL FK -> users(id)`
- `case_id BIGINT NOT NULL FK -> cases(id)`
- `template_id BIGINT NOT NULL FK -> templates(id)`
- `status TEXT NOT NULL` CHECK in (`borrador_editable`,`finalizado`,`exportado`)
- `rendered_content TEXT NOT NULL` (versión textual actual)
- `finalized_at TIMESTAMPTZ NULL`
- `created_at TIMESTAMPTZ NOT NULL`
- `updated_at TIMESTAMPTZ NOT NULL`
- `deleted_at TIMESTAMPTZ NULL`

Reglas:
- ownership consistente entre user/case/template.

Índices:
- `INDEX (case_id, created_at DESC)`
- `INDEX (user_id, updated_at DESC)`

---

### `document_exports`
**Propósito**: artefactos exportados (PDF/DOCX) por documento generado.

Columnas clave:
- `id BIGINT PK`
- `generated_document_id BIGINT NOT NULL FK -> generated_documents(id)`
- `format TEXT NOT NULL` CHECK in (`pdf`,`docx`)
- `storage_provider TEXT NOT NULL`
- `storage_bucket TEXT NOT NULL`
- `storage_object_key TEXT NOT NULL`
- `size_bytes BIGINT NULL`
- `created_at TIMESTAMPTZ NOT NULL`
- `deleted_at TIMESTAMPTZ NULL`
- `purged_at TIMESTAMPTZ NULL`

Reglas:
- `UNIQUE (storage_provider, storage_bucket, storage_object_key)`

Índices:
- `INDEX (generated_document_id, created_at DESC)`

---

## E. Trazabilidad, auditoría y errores

### `activity_events`
**Propósito**: eventos relevantes para confianza, auditabilidad básica y soporte.

Columnas clave:
- `id BIGINT PK`
- `user_id BIGINT NULL FK -> users(id)` (puede ser evento de sistema)
- `event_type TEXT NOT NULL` (ej. `source_document_uploaded`, `template_validated`, `document_generated`, `artifact_deleted`)
- `resource_type TEXT NOT NULL`
- `resource_id BIGINT NOT NULL`
- `severity TEXT NOT NULL` CHECK in (`info`,`warning`,`error`)
- `message TEXT NULL`
- `metadata JSONB NOT NULL DEFAULT '{}'`
- `occurred_at TIMESTAMPTZ NOT NULL`

Índices:
- `INDEX (user_id, occurred_at DESC)`
- `INDEX (resource_type, resource_id, occurred_at DESC)`
- `INDEX (event_type, occurred_at DESC)`
- `GIN (metadata)` opcional

---

## 4) Reglas de integridad (invariantes clave)

1. **Plantilla no validada no genera documentos**.
2. **Caso no pasa a `listo_para_generar` si faltan campos obligatorios**.
3. **No se genera documento si caso incompleto**.
4. **Todo documento generado debe referenciar caso y plantilla válidos**.
5. **Propiedad consistente**: usuario de `case`, `template`, `generated_document` debe coincidir.
6. **Baja confianza visible**: `document_analysis_jobs.confidence_level='baja'` debe disparar warning/evento y revisión reforzada.
7. **Borrado con trazabilidad**: soft delete registra evento; purga física registra `purged_at` + evento.
8. **Aislamiento por usuario**: consultas de negocio filtradas por `user_id` y reforzadas con RLS temprana en tablas sensibles.
9. **Consumo MVP fijo**: cada operación de análisis/generación descuenta exactamente 1 unidad en `usage_ledger`.
10. **Secuencia de borrado**: primero `deleted_at` (soft delete), luego `purged_at` (purga física diferida).
11. **Purga con ventana fija**: `purged_at` no antes de 30 días desde `deleted_at` (enforced por job de purga + guardas de aplicación).

---

## 5) Recomendaciones de índices (MVP)

Mínimos recomendados:
- Todos los FK indexados manualmente.
- Índices compuestos para listados principales:
  - `templates (user_id, status, updated_at DESC)`
  - `source_documents (user_id, uploaded_at DESC)`
  - `cases (user_id, updated_at DESC)`
  - `generated_documents (user_id, updated_at DESC)`
- Índices por trazabilidad:
  - `activity_events (resource_type, resource_id, occurred_at DESC)`
- Parciales para soft delete:
  - índices `WHERE deleted_at IS NULL` en listados calientes.

No agregar GIN en JSONB por defecto salvo query real confirmada.

---

## 6) Trazabilidad modelada

Se resuelve con dos capas complementarias:

1. **Traza de dato detectado** (`field_source_traces`): evidencia del origen del campo en documento fuente.
2. **Traza de actividad** (`activity_events`): cronología de acciones de usuario/sistema y estados relevantes.

Esto permite explicar:
- de dónde salió un dato,
- qué se validó manualmente,
- cuándo se generó/exportó/eliminó un artefacto,
- y qué falló cuando algo no pudo continuar.

---

## 7) Privacidad, retención y borrado

### Enfoque MVP recomendado
- **Soft delete** en entidades sensibles (`deleted_at`).
- **Purga física diferida** (`purged_at`) para coordinación con object storage.
- **Eventos obligatorios** para todo borrado/purga.
- **Ventana de purga cerrada para MVP**: 30 días desde `deleted_at`.

### Alcance de retención
- El binario en storage se conserva mientras haya artefactos dependientes de negocio.
- Al pedir borrado total, se marca lógico primero y se purga cuando no quedan dependencias, respetando la ventana de 30 días.
- Toda purga física debe registrar evento explícito en `activity_events` (ej. `artifact_purged`).

---

## 8) Preservación de abstracción de proveedores en modelo DB

El esquema guarda solo:
- `provider_kind` / `storage_provider`
- identificadores neutrales (`bucket`, `object_key`, `provider_model`)
- metadata técnica acotada (JSONB cuando haga falta)

No se acopla a estructuras propietarias de OpenRouter/Firebase. Cambiar proveedor implica cambiar adaptadores de infraestructura, no el lenguaje del dominio.

---

## 9) Errores y estados operacionales (failure modeling)

Para procesos críticos (análisis/generación) se modela explícitamente:
- `status` de ejecución,
- `failure_code` clasificable (persistido como `TEXT`),
- `failure_message` diagnóstica,
- emisión de `activity_events` con `severity`.

Decisión cerrada MVP: el catálogo canónico de `failure_code` vive en backend (código), no normalizado en tabla de referencia DB.

Esto evita fallos silenciosos y deja estados accionables para UI/soporte.

---

## 10) Decisiones cerradas y congelamiento suficiente para implementación inicial

1. **Consumo**: `usage_ledger.units = 1` para análisis y generación en MVP.
2. **Borrado**: soft delete obligatorio primero; purga física diferida después.
3. **Política de purga**: 30 días tras `deleted_at`, con evento `artifact_purged`.
4. **RLS**: habilitar temprano en tablas sensibles con ownership de usuario (`source_documents`, `templates`, `cases`, `generated_documents`, `usage_ledger`, `activity_events`) con políticas mínimas de aislamiento por `user_id`.
5. **Versionado de plantillas**: fuera de MVP (sin tabla de versiones).
6. **Failure codes**: persistencia `TEXT`, catálogo canónico en backend.
7. **Trazabilidad mínima**: `field_source_traces.excerpt_text` + `locator_json.page`; el resto es enriquecimiento opcional.
8. **Aislamiento operativo por entorno**: instancias o bases distintas para dev/test/prod; prohibido compartir DB entre test y dev.

Con estas decisiones, el diseño queda **intencionalmente congelado** para iniciar coding de migraciones y capa de repositorios sin esperar definiciones adicionales de modelo.

### Orden recomendado de implementación MVP

1. **Base e identidad**: `users`, `subscriptions`, `usage_ledger` (+ índices y checks básicos).
2. **Ingesta/análisis**: `source_documents`, `document_analysis_jobs`, `analysis_results`.
3. **Plantillas**: `templates`, `template_entities`, `template_fields`, `template_rules`, `field_source_traces`.
4. **Casos/generación**: `cases`, `case_field_values`, `generated_documents`, `document_exports`.
5. **Auditabilidad/borrado**: `activity_events`, job de purga diferida (30 días), eventos de borrado/purga.
6. **Seguridad DB**: activar RLS en tablas sensibles con políticas mínimas (SELECT/UPDATE/DELETE por `user_id`), manteniendo lógica de negocio principal en aplicación.

---

## 11) Snippet ilustrativo (opcional, no migración)

```sql
-- Ejemplo de unicidad de nombre de plantilla activa por usuario
CREATE UNIQUE INDEX ux_templates_user_name_active
  ON templates (user_id, name)
  WHERE deleted_at IS NULL;
```

Este snippet solo ilustra una decisión de integridad clave del MVP.
