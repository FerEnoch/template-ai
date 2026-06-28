-- Migration: 0011_casos_name.sql
-- Purpose: Add optional custom name column to casos so generated documents
-- can be renamed independently from their parent template.
-- Existing rows keep name = null and continue displaying template.name.
-- No RLS change: existing casos_update policy covers the new column.

ALTER TABLE casos ADD COLUMN IF NOT EXISTS name TEXT NULL;
