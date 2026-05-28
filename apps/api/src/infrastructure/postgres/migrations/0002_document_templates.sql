-- Migration: 0002_document_templates.sql
-- Tables: documents, analysis_results, entities, templates
-- Purpose: Persistent storage for document upload, analysis, entity review, and templates
-- RLS: follows 0001 pattern — ownership via user_id = app.current_user_id

CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'processing',
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT documents_status_allowed CHECK (
    status IN ('pending', 'processing', 'completed', 'failed')
  )
);

CREATE TABLE analysis_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'processing',
  progress INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  CONSTRAINT analysis_results_status_allowed CHECK (
    status IN ('pending', 'processing', 'completed', 'failed')
  ),
  CONSTRAINT analysis_results_progress_range CHECK (progress BETWEEN 0 AND 100)
);

CREATE TABLE entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_result_id UUID NOT NULL REFERENCES analysis_results(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  value TEXT NOT NULL,
  "group" TEXT NOT NULL,
  confidence TEXT NOT NULL,
  source_span JSONB,
  reviewed BOOLEAN NOT NULL DEFAULT false,
  excluded BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT entities_group_allowed CHECK ("group" IN ('PARTES', 'INMUEBLE', 'FECHAS', 'ANEXOS')),
  CONSTRAINT entities_confidence_allowed CHECK (confidence IN ('ALTA', 'MEDIA', 'BAJA'))
);

CREATE TABLE templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE RESTRICT,
  category TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  entities JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT templates_status_allowed CHECK (status IN ('draft', 'published', 'archived')),
  CONSTRAINT templates_name_unique_per_user UNIQUE (user_id, name)
);

CREATE INDEX documents_user_id_idx ON documents (user_id);
CREATE INDEX analysis_results_document_id_idx ON analysis_results (document_id);
CREATE INDEX entities_analysis_result_id_idx ON entities (analysis_result_id);
CREATE INDEX entities_document_id_idx ON entities (document_id);
CREATE INDEX templates_user_id_idx ON templates (user_id);

-- RLS: follow 0001 pattern — ownership via user_id = app.current_user_id
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents FORCE ROW LEVEL SECURITY;
ALTER TABLE analysis_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_results FORCE ROW LEVEL SECURITY;
ALTER TABLE entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE entities FORCE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates FORCE ROW LEVEL SECURITY;

-- documents: direct user_id column
CREATE POLICY documents_insert ON documents FOR INSERT WITH CHECK (
  current_setting('app.current_user_id', true) IS NOT NULL
  AND user_id = current_setting('app.current_user_id', true)::BIGINT
);
CREATE POLICY documents_select ON documents FOR SELECT USING (
  current_setting('app.current_user_id', true) IS NOT NULL
  AND user_id = current_setting('app.current_user_id', true)::BIGINT
);
CREATE POLICY documents_update ON documents FOR UPDATE USING (
  current_setting('app.current_user_id', true) IS NOT NULL
  AND user_id = current_setting('app.current_user_id', true)::BIGINT
);
CREATE POLICY documents_delete ON documents FOR DELETE USING (
  current_setting('app.current_user_id', true) IS NOT NULL
  AND user_id = current_setting('app.current_user_id', true)::BIGINT
);

-- analysis_results: ownership through documents.user_id
CREATE POLICY analysis_results_insert ON analysis_results FOR INSERT WITH CHECK (
  current_setting('app.current_user_id', true) IS NOT NULL
  AND document_id IN (
    SELECT id FROM documents WHERE user_id = current_setting('app.current_user_id', true)::BIGINT
  )
);
CREATE POLICY analysis_results_select ON analysis_results FOR SELECT USING (
  current_setting('app.current_user_id', true) IS NOT NULL
  AND document_id IN (
    SELECT id FROM documents WHERE user_id = current_setting('app.current_user_id', true)::BIGINT
  )
);
CREATE POLICY analysis_results_update ON analysis_results FOR UPDATE USING (
  current_setting('app.current_user_id', true) IS NOT NULL
  AND document_id IN (
    SELECT id FROM documents WHERE user_id = current_setting('app.current_user_id', true)::BIGINT
  )
);

-- entities: ownership through documents.user_id
CREATE POLICY entities_insert ON entities FOR INSERT WITH CHECK (
  current_setting('app.current_user_id', true) IS NOT NULL
  AND document_id IN (
    SELECT id FROM documents WHERE user_id = current_setting('app.current_user_id', true)::BIGINT
  )
);
CREATE POLICY entities_select ON entities FOR SELECT USING (
  current_setting('app.current_user_id', true) IS NOT NULL
  AND document_id IN (
    SELECT id FROM documents WHERE user_id = current_setting('app.current_user_id', true)::BIGINT
  )
);
CREATE POLICY entities_update ON entities FOR UPDATE USING (
  current_setting('app.current_user_id', true) IS NOT NULL
  AND document_id IN (
    SELECT id FROM documents WHERE user_id = current_setting('app.current_user_id', true)::BIGINT
  )
);

-- templates: direct user_id column
CREATE POLICY templates_insert ON templates FOR INSERT WITH CHECK (
  current_setting('app.current_user_id', true) IS NOT NULL
  AND user_id = current_setting('app.current_user_id', true)::BIGINT
);
CREATE POLICY templates_select ON templates FOR SELECT USING (
  current_setting('app.current_user_id', true) IS NOT NULL
  AND user_id = current_setting('app.current_user_id', true)::BIGINT
);
CREATE POLICY templates_update ON templates FOR UPDATE USING (
  current_setting('app.current_user_id', true) IS NOT NULL
  AND user_id = current_setting('app.current_user_id', true)::BIGINT
);
CREATE POLICY templates_delete ON templates FOR DELETE USING (
  current_setting('app.current_user_id', true) IS NOT NULL
  AND user_id = current_setting('app.current_user_id', true)::BIGINT
);