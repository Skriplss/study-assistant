-- Spaced repetition state, one row per (user, question). Questions already live
-- in the DB and answers.is_correct gives a first grade, so scheduling needs no
-- new content and no AI call — a review replays a question you've already seen.
--
-- SM-2 fields: ease_factor drifts with performance (floored at 1.3 per the
-- algorithm), interval_days is the current gap, repetitions is the streak of
-- successful recalls (reset to 0 on a lapse).
CREATE TABLE IF NOT EXISTS review_items (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  ease_factor NUMERIC(4, 2) NOT NULL DEFAULT 2.5,
  interval_days INTEGER NOT NULL DEFAULT 0,
  repetitions INTEGER NOT NULL DEFAULT 0,
  next_review_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, question_id)
);

-- The only hot query: "what's due for me right now", newest interval first.
CREATE INDEX IF NOT EXISTS idx_review_items_due
  ON review_items (user_id, next_review_at);

CREATE TRIGGER update_review_items_updated_at BEFORE UPDATE ON review_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE review_items ENABLE ROW LEVEL SECURITY;

-- App traffic goes through the service-role client and bypasses these, but they
-- keep the table closed to the anon key like every other table in the schema.
CREATE POLICY "Users can view their own review items" ON review_items
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own review items" ON review_items
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own review items" ON review_items
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own review items" ON review_items
  FOR DELETE USING (auth.uid() = user_id);
