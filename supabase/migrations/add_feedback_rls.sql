-- add_feedback.sql created `feedback` without the RLS block every other table gets.
-- Live anon reads are already returning nothing, so this codifies the intended
-- state rather than plugging an open leak — but it stops the next `supabase db
-- reset` from rebuilding the table unprotected.
-- App traffic uses the service-role client and bypasses RLS either way; admin
-- reads (GET /api/feedback) therefore need no policy here.
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own feedback" ON feedback;
CREATE POLICY "Users can view their own feedback" ON feedback
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own feedback" ON feedback;
CREATE POLICY "Users can insert their own feedback" ON feedback
  FOR INSERT WITH CHECK (auth.uid() = user_id);
