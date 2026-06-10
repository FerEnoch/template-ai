-- Migration: 0007_user_created_entities.sql
-- Purpose: Add user_created column to entities for manual entity tracking.
-- Enables counting user-created entities per document for the 5-entity cap.
-- Default false: all existing AI-generated entities remain unaffected.

ALTER TABLE entities
  ADD COLUMN IF NOT EXISTS user_created BOOLEAN NOT NULL DEFAULT false;
