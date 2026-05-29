-- Migration: 0004_ai_file_persistence.sql
-- Purpose: Add file_path to documents for persisted uploads, retry tracking to analysis_results

ALTER TABLE documents ADD COLUMN file_path TEXT;

ALTER TABLE analysis_results ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE analysis_results ADD COLUMN error_message TEXT;

ALTER TABLE analysis_results ADD CONSTRAINT retry_count_range CHECK (retry_count BETWEEN 0 AND 3);