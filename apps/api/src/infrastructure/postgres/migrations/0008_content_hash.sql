-- Migration: 0008_content_hash.sql
-- Purpose: Add content_hash column to documents for upload deduplication.
-- Enables cache-hit detection by SHA-256 hash of raw file bytes.
-- Nullable: existing rows stay NULL, dedup query only matches non-null hashes.

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS content_hash TEXT;

CREATE INDEX IF NOT EXISTS documents_content_hash_idx
  ON documents(content_hash)
  WHERE content_hash IS NOT NULL;
