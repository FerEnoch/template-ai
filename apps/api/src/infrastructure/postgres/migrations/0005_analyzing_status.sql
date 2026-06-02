-- Migration: 0005_analyzing_status.sql
-- Purpose: Add 'analyzing' status to analysis_results CHECK constraint.
-- The 'analyzing' status signals that progress has reached 100 and the
-- AI extraction call is about to start (outside the DB transaction).
-- This decouples the long-running AI call from holding a pool connection.

ALTER TABLE analysis_results DROP CONSTRAINT IF EXISTS analysis_results_status_allowed;

ALTER TABLE analysis_results ADD CONSTRAINT analysis_results_status_allowed
  CHECK (status IN ('pending', 'processing', 'analyzing', 'completed', 'failed'));
