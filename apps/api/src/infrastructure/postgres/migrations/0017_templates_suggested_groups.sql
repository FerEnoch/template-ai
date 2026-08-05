-- Migration: 0017_templates_suggested_groups.sql
-- Purpose: Persist model-suggested dynamic groups and their approval status per template

ALTER TABLE templates
ADD COLUMN suggested_groups_status JSONB NOT NULL DEFAULT '{}';
