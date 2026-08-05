ALTER TABLE casos ADD COLUMN IF NOT EXISTS content_title TEXT NULL;
-- No backfill needed; nullable column
