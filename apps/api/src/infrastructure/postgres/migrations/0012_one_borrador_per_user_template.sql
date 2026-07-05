-- Migration: 0011_one_borrador_per_user_template.sql
-- Purpose: Enforce at most one borrador case per (user, template) at the DB level.
-- Prevents TOCTOU races where two concurrent POSTs both see "no borrador"
-- and insert duplicate rows under READ COMMITTED.

CREATE UNIQUE INDEX IF NOT EXISTS casos_one_borrador_per_user_template
  ON casos (user_id, template_id)
  WHERE status = 'borrador';
