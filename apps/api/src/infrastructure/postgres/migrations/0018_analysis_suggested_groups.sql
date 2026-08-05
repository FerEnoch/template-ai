-- Add suggested_groups column to analysis_results so model-suggested groups
-- survive between the analysis job and the template-creation flow.
ALTER TABLE analysis_results
  ADD COLUMN IF NOT EXISTS suggested_groups JSONB NOT NULL DEFAULT '[]';
