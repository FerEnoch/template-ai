-- Migration: 0016_entities_reviewed_at.sql
-- Purpose: Track when an entity was reviewed for few-shot selection ordering

ALTER TABLE entities
ADD COLUMN reviewed_at TIMESTAMPTZ;

-- Backfill existing reviewed entities so they are immediately eligible as few-shot examples.
UPDATE entities
SET reviewed_at = NOW()
WHERE reviewed = true AND reviewed_at IS NULL;

-- Partial index to speed up few-shot candidate selection.
CREATE INDEX IF NOT EXISTS entities_reviewed_at_idx
ON entities (reviewed_at DESC)
WHERE reviewed = true AND excluded = false;
