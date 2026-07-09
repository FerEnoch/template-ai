-- Migration: 0011_borrador_unique.sql
-- Purpose: Enforce at most one borrador per (user_id, template_id).
-- Prevents the TOCTOU race where two concurrent POST /api/cases create
-- duplicate borradores for the same template.
--
-- Step 1: Deduplicate pre-existing borradores. Keep the most recently
--         updated one per (user_id, template_id); archive the rest.
-- Step 2: Create a partial unique index so the repository's ON CONFLICT
--         clause is guaranteed to work. Uses a plain index (not
--         CONCURRENTLY) because migrate.ts wraps every file in a
--         transaction and PostgreSQL rejects CONCURRENTLY inside BEGIN.
--         The casos table is small — a brief AccessExclusiveLock is fine.

-- 1. Deduplicate: archive stale borradores, keep the latest
WITH duplicates AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY user_id, template_id
           ORDER BY updated_at DESC
         ) AS rn
  FROM casos
  WHERE status = 'borrador'
)
UPDATE casos SET status = 'archivado', updated_at = now()
WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);

-- 2. Prevent future duplicates
CREATE UNIQUE INDEX IF NOT EXISTS casos_one_borrador_per_user_template
  ON casos (user_id, template_id) WHERE status = 'borrador';
