-- ============================================================
-- PostgreSQL Schema - template-ai MVP
-- Orden de creación: identidad → ingesta → plantillas → casos → auditoría
-- ============================================================

-- ============================================================
-- A. IDENTIDAD, ACCESO Y PLAN
-- ============================================================

-- --------------------------------------------------
-- users: identidad del usuario (MVP Google OAuth)
-- --------------------------------------------------
CREATE TABLE users (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    public_id UUID NOT NULL UNIQUE,
    email TEXT NOT NULL,
    email_normalized TEXT NOT NULL,
    display_name TEXT NOT NULL,
    google_subject TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ NULL
);

-- Unicidad en email normalizado y google subject
CREATE UNIQUE INDEX ux_users_email_normalized ON users (email_normalized);
CREATE UNIQUE INDEX ux_users_google_subject ON users (google_subject);

-- Índices para consultas frecuentes
CREATE INDEX ix_users_created_at ON users (created_at);
CREATE INDEX ix_users_deleted_at ON users (deleted_at) WHERE deleted_at IS NOT NULL;

-- --------------------------------------------------
-- subscriptions: estado de acceso y vigencia del plan
-- --------------------------------------------------
CREATE TABLE subscriptions (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    status TEXT NOT NULL CHECK (
        status IN ('activa', 'limitada', 'sin_acceso', 'cancelada')
    ),
    plan_code TEXT NOT NULL,
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Una suscripción vigente por usuario en un período
-- (MVP: validación de no superposición diferida a app)
CREATE UNIQUE INDEX ux_subscriptions_user_period 
    ON subscriptions (user_id, period_start);

-- Índices para consultas frecuentes
CREATE INDEX ix_subscriptions_user_status ON subscriptions (user_id, status);
CREATE INDEX ix_subscriptions_period_end ON subscriptions (period_end);

-- Índice en FK (manual, PostgreSQL no lo hace automático)
CREATE INDEX ix_subscriptions_user_id ON subscriptions (user_id);

-- --------------------------------------------------
-- usage_ledger: registro auditable de consumo
-- --------------------------------------------------
CREATE TABLE usage_ledger (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    subscription_id BIGINT NULL REFERENCES subscriptions(id) ON DELETE SET NULL,
    operation_type TEXT NOT NULL CHECK (
        operation_type IN ('analisis_documento', 'generacion_documento')
    ),
    units INTEGER NOT NULL CHECK (units > 0),
    operation_ref_type TEXT NOT NULL,
    operation_ref_id BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para consultas de uso
CREATE INDEX ix_usage_ledger_user_created 
    ON usage_ledger (user_id, created_at DESC);
CREATE INDEX ix_usage_ledger_subscription_created 
    ON usage_ledger (subscription_id, created_at DESC);
CREATE INDEX ix_usage_ledger_ref 
    ON usage_ledger (operation_ref_type, operation_ref_id);

-- Índice en FK
CREATE INDEX ix_usage_ledger_user_id ON usage_ledger (user_id);
CREATE INDEX ix_usage_ledger_subscription_id ON usage_ledger (subscription_id);


-- ============================================================
-- B. INGESTA Y ANÁLISIS DOCUMENTAL
-- ============================================================

-- --------------------------------------------------
-- source_documents: documento subido por usuario
-- --------------------------------------------------
CREATE TABLE source_documents (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    public_id UUID NOT NULL UNIQUE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    filename_original TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size_bytes BIGINT NOT NULL CHECK (size_bytes > 0),
    storage_provider TEXT NOT NULL,
    storage_object_key TEXT NOT NULL,
    storage_bucket TEXT NOT NULL,
    status TEXT NOT NULL CHECK (
        status IN ('subido', 'en_analisis', 'apto', 'no_apto', 'analizado', 'fallido')
    ),
    aptitude_reason_code TEXT NULL,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ NULL,
    purged_at TIMESTAMPTZ NULL,
    
    -- Check: si hay purged_at, debe haber deleted_at
    CONSTRAINT chk_purged_requires_deleted 
        CHECK (purged_at IS NULL OR deleted_at IS NOT NULL)
);

-- Unicidad en storage (evita duplicados del mismo objeto)
CREATE UNIQUE INDEX ux_source_documents_storage 
    ON source_documents (storage_provider, storage_bucket, storage_object_key);

-- Índices para consultas frecuentes
CREATE INDEX ix_source_documents_user_uploaded 
    ON source_documents (user_id, uploaded_at DESC);
CREATE INDEX ix_source_documents_status_uploaded 
    ON source_documents (status, uploaded_at DESC);
CREATE INDEX ix_source_documents_deleted_at 
    ON source_documents (deleted_at) WHERE deleted_at IS NOT NULL;

-- Índice en FK
CREATE INDEX ix_source_documents_user_id ON source_documents (user_id);

-- --------------------------------------------------
-- document_analysis_jobs: ejecuciones de análisis
-- --------------------------------------------------
CREATE TABLE document_analysis_jobs (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    source_document_id BIGINT NOT NULL 
        REFERENCES source_documents(id) ON DELETE CASCADE,
    triggered_by_user_id BIGINT NULL 
        REFERENCES users(id) ON DELETE SET NULL,
    provider_kind TEXT NOT NULL CHECK (
        provider_kind IN ('openrouter', 'otro')
    ),
    provider_model TEXT NULL,
    status TEXT NOT NULL CHECK (
        status IN ('pendiente', 'en_proceso', 'completado', 'fallido')
    ),
    confidence_level TEXT NULL CHECK (
        confidence_level IN ('alta', 'baja')
    ),
    failure_code TEXT NULL,
    failure_message TEXT NULL,
    started_at TIMESTAMPTZ NULL,
    finished_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- Check: finished_at >= started_at cuando ambos existen
    CONSTRAINT chk_timing CHECK (
        finished_at IS NULL OR started_at IS NULL 
        OR finished_at >= started_at
    )
);

-- Índices para consultas frecuentes
CREATE INDEX ix_document_analysis_jobs_doc_created 
    ON document_analysis_jobs (source_document_id, created_at DESC);
CREATE INDEX ix_document_analysis_jobs_status_created 
    ON document_analysis_jobs (status, created_at DESC);
CREATE INDEX ix_document_analysis_jobs_provider_created 
    ON document_analysis_jobs (provider_kind, created_at DESC);

-- Índice en FK
CREATE INDEX ix_document_analysis_jobs_source_document_id 
    ON document_analysis_jobs (source_document_id);
CREATE INDEX ix_document_analysis_jobs_triggered_by_user_id 
    ON document_analysis_jobs (triggered_by_user_id);

-- --------------------------------------------------
-- analysis_results: resultado estructurado de análisis
-- --------------------------------------------------
CREATE TABLE analysis_results (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    analysis_job_id BIGINT NOT NULL UNIQUE 
        REFERENCES document_analysis_jobs(id) ON DELETE CASCADE,
    extracted_text TEXT NULL,
    structure_snapshot JSONB NOT NULL DEFAULT '{}',
    detection_snapshot JSONB NOT NULL DEFAULT '{}',
    ambiguities_snapshot JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- GIN índices opcionales para queries en JSONB
-- Descomentar solo si se van a consultar estos campos
-- CREATE INDEX ix_analysis_results_structure_gin 
--     ON analysis_results USING GIN (structure_snapshot);
-- CREATE INDEX ix_analysis_results_detection_gin 
--     ON analysis_results USING GIN (detection_snapshot);

-- Índice en FK
CREATE INDEX ix_analysis_results_analysis_job_id 
    ON analysis_results (analysis_job_id);


-- ============================================================
-- C. PLANTILLAS Y VALIDACIÓN HUMANA
-- ============================================================

-- --------------------------------------------------
-- templates: plantilla reusable del usuario
-- --------------------------------------------------
CREATE TABLE templates (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    public_id UUID NOT NULL UNIQUE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    source_document_id BIGINT NULL 
        REFERENCES source_documents(id) ON DELETE SET NULL,
    analysis_result_id BIGINT NULL 
        REFERENCES analysis_results(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT NULL,
    status TEXT NOT NULL CHECK (
        status IN ('borrador', 'validada', 'archivada')
    ),
    validated_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ NULL,
    
    -- validated_at obligatorio si status = 'validada'
    CONSTRAINT chk_validated_requires_validada 
        CHECK (
            status != 'validada' 
            OR (status = 'validada' AND validated_at IS NOT NULL)
        )
);

-- Unicidad de nombre activo por usuario
CREATE UNIQUE INDEX ux_templates_user_name_active 
    ON templates (user_id, name) 
    WHERE deleted_at IS NULL;

-- Índices para consultas frecuentes
CREATE INDEX ix_templates_user_status_updated 
    ON templates (user_id, status, updated_at DESC);
CREATE INDEX ix_templates_source_document_id 
    ON templates (source_document_id);

-- Índices en FK
CREATE INDEX ix_templates_user_id ON templates (user_id);
CREATE INDEX ix_templates_source_document_id_idx ON templates (source_document_id);
CREATE INDEX ix_templates_analysis_result_id ON templates (analysis_result_id);

-- --------------------------------------------------
-- template_entities: agrupadores semánticos de campos
-- --------------------------------------------------
CREATE TABLE template_entities (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    template_id BIGINT NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    entity_type TEXT NULL,
    display_order INTEGER NOT NULL CHECK (display_order >= 0)
);

-- Unicidad de nombre por plantilla
CREATE UNIQUE INDEX ux_template_entities_template_name 
    ON template_entities (template_id, name);

-- Índice para ordenamiento
CREATE INDEX ix_template_entities_template_order 
    ON template_entities (template_id, display_order);

-- Índice en FK
CREATE INDEX ix_template_entities_template_id ON template_entities (template_id);

-- --------------------------------------------------
-- template_fields: campos variables en plantilla
-- --------------------------------------------------
CREATE TABLE template_fields (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    template_id BIGINT NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
    entity_id BIGINT NULL REFERENCES template_entities(id) ON DELETE SET NULL,
    field_key TEXT NOT NULL,
    label TEXT NOT NULL,
    data_type TEXT NOT NULL CHECK (
        data_type IN ('texto', 'numero', 'fecha', 'booleano')
    ),
    is_required BOOLEAN NOT NULL DEFAULT false,
    is_repeatable BOOLEAN NOT NULL DEFAULT false,
    repeat_group_key TEXT NULL,
    display_order INTEGER NOT NULL CHECK (display_order >= 0),
    created_from_detection BOOLEAN NOT NULL DEFAULT true
);

-- Unicidad de field_key por plantilla
CREATE UNIQUE INDEX ux_template_fields_template_field_key 
    ON template_fields (template_id, field_key);

-- Índices para consultas frecuentes
CREATE INDEX ix_template_fields_template_order 
    ON template_fields (template_id, display_order);
CREATE INDEX ix_template_fields_entity_order 
    ON template_fields (entity_id, display_order);

-- Índices en FK
CREATE INDEX ix_template_fields_template_id ON template_fields (template_id);
CREATE INDEX ix_template_fields_entity_id ON template_fields (entity_id);

-- --------------------------------------------------
-- template_rules: reglas de variación de plantilla
-- --------------------------------------------------
CREATE TABLE template_rules (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    template_id BIGINT NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
    rule_type TEXT NOT NULL CHECK (
        rule_type IN ('bloque_opcional', 'grupo_repetible', 'condicion_si_no')
    ),
    target_block_key TEXT NOT NULL,
    condition_field_key TEXT NULL,
    condition_operator TEXT NULL CHECK (
        condition_operator IN ('equals', 'not_equals', 'is_true', 'is_false', 'exists')
    ),
    condition_value_text TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice para consultas por tipo de regla
CREATE INDEX ix_template_rules_template_type 
    ON template_rules (template_id, rule_type);

-- Índice en FK
CREATE INDEX ix_template_rules_template_id ON template_rules (template_id);

-- --------------------------------------------------
-- field_source_traces: traza entre campo y origen
-- --------------------------------------------------
CREATE TABLE field_source_traces (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    template_field_id BIGINT NOT NULL 
        REFERENCES template_fields(id) ON DELETE CASCADE,
    source_document_id BIGINT NOT NULL 
        REFERENCES source_documents(id) ON DELETE CASCADE,
    analysis_job_id BIGINT NULL 
        REFERENCES document_analysis_jobs(id) ON DELETE SET NULL,
    excerpt_text TEXT NOT NULL,
    locator_json JSONB NOT NULL DEFAULT '{}',
    confidence_score NUMERIC(5,4) NULL CHECK (
        confidence_score >= 0 AND confidence_score <= 1
    ),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para consultas frecuentes
CREATE INDEX ix_field_source_traces_template_field_id 
    ON field_source_traces (template_field_id);
CREATE INDEX ix_field_source_traces_source_document_id 
    ON field_source_traces (source_document_id);

-- GIN índice opcional para locator_json
-- CREATE INDEX ix_field_source_traces_locator_gin 
--     ON field_source_traces USING GIN (locator_json);


-- ============================================================
-- D. CASOS Y GENERACIÓN DE DOCUMENTOS
-- ============================================================

-- --------------------------------------------------
-- cases: instancia de uso de plantilla
-- --------------------------------------------------
CREATE TABLE cases (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    public_id UUID NOT NULL UNIQUE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    template_id BIGINT NOT NULL REFERENCES templates(id) ON DELETE RESTRICT,
    name TEXT NOT NULL,
    status TEXT NOT NULL CHECK (
        status IN ('en_carga', 'listo_para_generar', 'generado')
    ),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ NULL
);

-- Índices para consultas frecuentes
CREATE INDEX ix_cases_user_updated ON cases (user_id, updated_at DESC);
CREATE INDEX ix_cases_template_created ON cases (template_id, created_at DESC);

-- Índices en FK
CREATE INDEX ix_cases_user_id ON cases (user_id);
CREATE INDEX ix_cases_template_id ON cases (template_id);

-- --------------------------------------------------
-- case_field_values: valores concretos del caso
-- --------------------------------------------------
CREATE TABLE case_field_values (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    case_id BIGINT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    template_field_id BIGINT NOT NULL 
        REFERENCES template_fields(id) ON DELETE CASCADE,
    repeat_index INTEGER NOT NULL DEFAULT 0 CHECK (repeat_index >= 0),
    value_text TEXT NULL,
    value_number NUMERIC(18,4) NULL,
    value_date DATE NULL,
    value_boolean BOOLEAN NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- Unicidad: caso + campo + repetición
    CONSTRAINT uq_case_field_repeat 
        UNIQUE (case_id, template_field_id, repeat_index)
);

-- Índices para consultas frecuentes
CREATE INDEX ix_case_field_values_case_id ON case_field_values (case_id);
CREATE INDEX ix_case_field_values_template_field_id 
    ON case_field_values (template_field_id);

-- --------------------------------------------------
-- generated_documents: resultados generados
-- --------------------------------------------------
CREATE TABLE generated_documents (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    public_id UUID NOT NULL UNIQUE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    case_id BIGINT NOT NULL REFERENCES cases(id) ON DELETE RESTRICT,
    template_id BIGINT NOT NULL REFERENCES templates(id) ON DELETE RESTRICT,
    status TEXT NOT NULL CHECK (
        status IN ('borrador_editable', 'finalizado', 'exportado')
    ),
    rendered_content TEXT NOT NULL,
    finalized_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ NULL
);

-- Índices para consultas frecuentes
CREATE INDEX ix_generated_documents_case_created 
    ON generated_documents (case_id, created_at DESC);
CREATE INDEX ix_generated_documents_user_updated 
    ON generated_documents (user_id, updated_at DESC);

-- Índices en FK
CREATE INDEX ix_generated_documents_user_id ON generated_documents (user_id);
CREATE INDEX ix_generated_documents_case_id ON generated_documents (case_id);
CREATE INDEX ix_generated_documents_template_id ON generated_documents (template_id);

-- --------------------------------------------------
-- document_exports: artefactos exportados (PDF/DOCX)
-- --------------------------------------------------
CREATE TABLE document_exports (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    generated_document_id BIGINT NOT NULL 
        REFERENCES generated_documents(id) ON DELETE CASCADE,
    format TEXT NOT NULL CHECK (format IN ('pdf', 'docx')),
    storage_provider TEXT NOT NULL,
    storage_bucket TEXT NOT NULL,
    storage_object_key TEXT NOT NULL,
    size_bytes BIGINT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ NULL,
    purged_at TIMESTAMPTZ NULL,
    
    CONSTRAINT chk_export_purged_requires_deleted 
        CHECK (purged_at IS NULL OR deleted_at IS NOT NULL)
);

-- Unicidad en storage
CREATE UNIQUE INDEX ux_document_exports_storage 
    ON document_exports (storage_provider, storage_bucket, storage_object_key);

-- Índice para consultas frecuentes
CREATE INDEX ix_document_exports_doc_created 
    ON document_exports (generated_document_id, created_at DESC);

-- Índice en FK
CREATE INDEX ix_document_exports_generated_document_id 
    ON document_exports (generated_document_id);


-- ============================================================
-- E. TRAZABILIDAD, AUDITORÍA Y ERRORES
-- ============================================================

-- --------------------------------------------------
-- activity_events: eventos para auditoría y soporte
-- --------------------------------------------------
CREATE TABLE activity_events (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NULL REFERENCES users(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id BIGINT NOT NULL,
    severity TEXT NOT NULL CHECK (
        severity IN ('info', 'warning', 'error')
    ),
    message TEXT NULL,
    metadata JSONB NOT NULL DEFAULT '{}',
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para consultas frecuentes
CREATE INDEX ix_activity_events_user_occurred 
    ON activity_events (user_id, occurred_at DESC);
CREATE INDEX ix_activity_events_resource_occurred 
    ON activity_events (resource_type, resource_id, occurred_at DESC);
CREATE INDEX ix_activity_events_type_occurred 
    ON activity_events (event_type, occurred_at DESC);

-- GIN índice opcional para metadata
-- CREATE INDEX ix_activity_events_metadata_gin 
--     ON activity_events USING GIN (metadata);

-- Índice en FK
CREATE INDEX ix_activity_events_user_id ON activity_events (user_id);


-- ============================================================
-- F. SEGURIDAD: Row Level Security (RLS)
-- ============================================================

-- Habilitar RLS en tablas sensibles

-- users: cada usuario ve su propio registro
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY pol_users_select ON users
    FOR SELECT USING (id = current_setting('app.current_user_id', true)::BIGINT);

-- subscriptions
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY pol_subscriptions_select ON subscriptions
    FOR SELECT USING (user_id = current_setting('app.current_user_id', true)::BIGINT);

-- usage_ledger
ALTER TABLE usage_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY pol_usage_ledger_select ON usage_ledger
    FOR SELECT USING (user_id = current_setting('app.current_user_id', true)::BIGINT);

-- source_documents
ALTER TABLE source_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY pol_source_documents_select ON source_documents
    FOR SELECT USING (user_id = current_setting('app.current_user_id', true)::BIGINT);

-- templates
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY pol_templates_select ON templates
    FOR SELECT USING (user_id = current_setting('app.current_user_id', true)::BIGINT);

-- cases
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY pol_cases_select ON cases
    FOR SELECT USING (user_id = current_setting('app.current_user_id', true)::BIGINT);

-- generated_documents
ALTER TABLE generated_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY pol_generated_documents_select ON generated_documents
    FOR SELECT USING (user_id = current_setting('app.current_user_id', true)::BIGINT);

-- activity_events (sistema puede ver todos, usuario solo los propios)
ALTER TABLE activity_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY pol_activity_events_select_system ON activity_events
    FOR SELECT USING (
        user_id = current_setting('app.current_user_id', true)::BIGINT
        OR user_id IS NULL  -- eventos de sistema
    );


-- ============================================================
-- COMENTARIOS PARA DOCUMENTACIÓN
-- ============================================================

COMMENT ON TABLE users IS 'Identidad del usuario (MVP Google OAuth)';
COMMENT ON TABLE subscriptions IS 'Estado de acceso y vigencia del plan único';
COMMENT ON TABLE usage_ledger IS 'Registro auditable de consumo (análisis/generación)';
COMMENT ON TABLE source_documents IS 'Documento subido por usuario + referencia a objeto binario';
COMMENT ON TABLE document_analysis_jobs IS 'Ejecuciones de extracción/detección por documento';
COMMENT ON TABLE analysis_results IS 'Resultado estructurado de análisis para revisión humana';
COMMENT ON TABLE templates IS 'Plantilla reusable del usuario';
COMMENT ON TABLE template_entities IS 'Agrupadores semánticos de campos dentro de plantilla';
COMMENT ON TABLE template_fields IS 'Campos variables definidos/validados en plantilla';
COMMENT ON TABLE template_rules IS 'Reglas simples de variación de MVP';
COMMENT ON TABLE field_source_traces IS 'Traza entre campo de plantilla y origen en documento fuente';
COMMENT ON TABLE cases IS 'Instancia de uso de plantilla para un caso concreto';
COMMENT ON TABLE case_field_values IS 'Valores concretos ingresados para cada campo del caso';
COMMENT ON TABLE generated_documents IS 'Resultados generados desde un caso';
COMMENT ON TABLE document_exports IS 'Artefactos exportados (PDF/DOCX)';
COMMENT ON TABLE activity_events IS 'Eventos relevantes para confianza y auditabilidad';