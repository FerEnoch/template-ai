-- Migration: 0009_casos.sql
-- Purpose: Create casos table for legal case management.
-- Each case links a user to a template, stores form_data (JSONB) and
-- AI-generated text. Status lifecycle: borrador → generado → exportado | archivado.
-- RLS: follows 0002 pattern — ownership via user_id = app.current_user_id

CREATE TABLE IF NOT EXISTS casos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  template_id UUID NOT NULL REFERENCES templates(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'borrador',
  form_data JSONB NOT NULL DEFAULT '{}',
  generated_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT casos_status_allowed
    CHECK (status IN ('borrador', 'generado', 'exportado', 'archivado'))
);

CREATE INDEX IF NOT EXISTS casos_user_id_idx ON casos (user_id);
CREATE INDEX IF NOT EXISTS casos_template_id_idx ON casos (template_id);
CREATE INDEX IF NOT EXISTS casos_user_created_at_idx ON casos (user_id, created_at DESC);

-- RLS: follow 0002 pattern — ownership via user_id = app.current_user_id
ALTER TABLE casos ENABLE ROW LEVEL SECURITY;
ALTER TABLE casos FORCE ROW LEVEL SECURITY;

CREATE POLICY casos_insert ON casos FOR INSERT WITH CHECK (
  current_setting('app.current_user_id', true) IS NOT NULL
  AND user_id = current_setting('app.current_user_id', true)::BIGINT
);
CREATE POLICY casos_select ON casos FOR SELECT USING (
  current_setting('app.current_user_id', true) IS NOT NULL
  AND user_id = current_setting('app.current_user_id', true)::BIGINT
);
CREATE POLICY casos_update ON casos FOR UPDATE USING (
  current_setting('app.current_user_id', true) IS NOT NULL
  AND user_id = current_setting('app.current_user_id', true)::BIGINT
);
CREATE POLICY casos_delete ON casos FOR DELETE USING (
  current_setting('app.current_user_id', true) IS NOT NULL
  AND user_id = current_setting('app.current_user_id', true)::BIGINT
);
