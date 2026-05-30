-- Migration: 0003_seed_poc_user.sql
-- Purpose: Seed a sentinel user for POC testing (no real auth yet)
-- The app hardcodes userId=0 for now — this ensures the FK constraint is satisfied.
-- RLS on `users` requires app.current_user_id to be set, so we set it before INSERT.

SET LOCAL app.current_user_id = 0;

INSERT INTO users (id, email, display_name, external_subject)
OVERRIDING SYSTEM VALUE
VALUES (0, 'poc@template-ai.local', 'POC User', 'poc-sentinel');
