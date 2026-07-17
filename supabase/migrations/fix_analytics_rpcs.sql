-- Both analytics RPCs in schema.sql have always raised 42703 at runtime:
--   get_performance_by_tag      -> column sm.tags does not exist
--   get_performance_by_category -> column ps.snapshot_date does not exist
-- AnalyticsService destructures only { data } and returns [] when it's null, so
-- the failures never surfaced: /api/analytics/performance and the two dashboard
-- charts (AnalyticsDashboard.tsx:71,81) have silently rendered empty since they
-- shipped. This rebuilds both against the schema that actually exists.
--
-- Two fixes per function:
--   * tags were never an array on study_materials — they live in material_tags,
--     so the tag RPC joins that table instead of unnest(sm.tags);
--   * progress_snapshots dates the row with completed_at, not snapshot_date.
-- Both also need explicit ::TEXT casts: tag and category are VARCHAR(100) in
-- the schema but the RETURNS TABLE contract declares TEXT, and PL/pgSQL raises
-- 42804 on the mismatch — so fixing the column names alone is not enough.

CREATE OR REPLACE FUNCTION get_performance_by_tag(
  p_user_id UUID,
  p_start_date TIMESTAMPTZ
)
RETURNS TABLE (
  tag TEXT,
  average_score NUMERIC,
  quiz_count BIGINT,
  question_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    mt.tag::TEXT,
    AVG(ps.score) AS average_score,
    COUNT(DISTINCT ps.quiz_id) AS quiz_count,
    SUM(q.total_questions) AS question_count
  FROM progress_snapshots ps
  JOIN quizzes q ON ps.quiz_id = q.id
  -- UNIQUE(material_id, tag) means one row per (material, tag), so a snapshot
  -- lands in each of its material's tag groups exactly once — no fan-out.
  JOIN material_tags mt ON mt.material_id = ps.material_id
  WHERE ps.user_id = p_user_id
    AND ps.completed_at >= p_start_date
  GROUP BY mt.tag;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_performance_by_category(
  p_user_id UUID,
  p_start_date TIMESTAMPTZ
)
RETURNS TABLE (
  category TEXT,
  average_score NUMERIC,
  quiz_count BIGINT,
  question_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    sm.category::TEXT,
    AVG(ps.score) AS average_score,
    COUNT(DISTINCT ps.quiz_id) AS quiz_count,
    SUM(q.total_questions) AS question_count
  FROM progress_snapshots ps
  JOIN quizzes q ON ps.quiz_id = q.id
  JOIN study_materials sm ON ps.material_id = sm.id
  WHERE ps.user_id = p_user_id
    AND ps.completed_at >= p_start_date
    AND sm.category IS NOT NULL
  GROUP BY sm.category;
END;
$$ LANGUAGE plpgsql;
