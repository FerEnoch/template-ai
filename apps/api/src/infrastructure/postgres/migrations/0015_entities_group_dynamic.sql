-- Migration: 0015_entities_group_dynamic.sql
-- Purpose: Allow arbitrary non-empty entity groups for GENERAL/OTROS/dynamic categories

ALTER TABLE entities
DROP CONSTRAINT IF EXISTS entities_group_allowed;

ALTER TABLE entities
ADD CONSTRAINT entities_group_non_empty CHECK (length(btrim("group")) > 0);
