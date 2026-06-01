-- Migration: 0006_extracted_text.sql
-- Purpose: Add extracted_text column to analysis_results for document preview.
-- Stores the raw text extracted from PDF/DOCX files before AI analysis.
-- NULL means: old record (pre-migration) OR text extraction failed.

ALTER TABLE analysis_results
  ADD COLUMN IF NOT EXISTS extracted_text TEXT;
