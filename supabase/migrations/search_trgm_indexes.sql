-- Accelerate SearchService's case-insensitive substring search.
-- Without these, `title ILIKE '%term%'` and `parsed_content ILIKE '%term%'`
-- do sequential scans. pg_trgm + GIN turns them into index lookups.
--
-- Apply in the Supabase SQL editor (or `supabase db push`).

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_study_materials_title_trgm
  ON study_materials USING gin (title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_study_materials_content_trgm
  ON study_materials USING gin (parsed_content gin_trgm_ops);
