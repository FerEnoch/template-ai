-- Migration: 0010_template_soft_delete.sql
-- Purpose: Template soft-delete with 30-day purge window + source-document cascade support.

ALTER TABLE templates ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;

-- Make document_id nullable and change FK to ON DELETE SET NULL
-- so hard-deleting the source document auto-nulls the template reference.
ALTER TABLE templates ALTER COLUMN document_id DROP NOT NULL;
ALTER TABLE templates DROP CONSTRAINT IF EXISTS templates_document_id_fkey;
ALTER TABLE templates ADD CONSTRAINT templates_document_id_fkey
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS templates_deleted_at_idx
  ON templates (deleted_at) WHERE deleted_at IS NOT NULL;
