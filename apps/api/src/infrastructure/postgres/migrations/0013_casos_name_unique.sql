-- Migration: 0012_casos_name_unique.sql
-- Purpose: Enforce per-user uniqueness of non-null case (document) names so
-- generated documents cannot share a custom name, mirroring the templates
-- UNIQUE (user_id, name) constraint. A PARTIAL unique index is used because
-- casos.name is nullable: NULL names are exempt, so multiple documents with
-- no custom name continue to fall back to their parent template name.
--
-- Pre-cleanup: existing duplicate non-null names within a user are reset to
-- NULL (keeping the most recently updated row) so the unique index can be
-- created. Affected documents revert to displaying their template name.
-- This is a one-time dev-data repair; in production it only touches rows
-- that already violate the new constraint.

UPDATE casos c
SET name = NULL, updated_at = now()
WHERE name IS NOT NULL
  AND id <> (
    SELECT id
    FROM casos keep
    WHERE keep.user_id = c.user_id AND keep.name = c.name
    ORDER BY keep.updated_at DESC, keep.created_at DESC
    LIMIT 1
  )
  AND (
    SELECT COUNT(*)
    FROM casos other
    WHERE other.user_id = c.user_id AND other.name = c.name
  ) > 1;

CREATE UNIQUE INDEX IF NOT EXISTS casos_user_name_uniq
  ON casos (user_id, name)
  WHERE name IS NOT NULL;
