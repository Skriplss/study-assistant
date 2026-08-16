-- Brute-force throttling for the auth endpoints.
--
-- Why this lives in Postgres and not in process memory: on Vercel every request
-- may hit a different lambda and a cold start wipes memory, so an in-memory
-- counter is a counter the attacker resets for free.
--
-- Why it is needed at all: sign-in runs server-side, so Supabase's own per-IP
-- limiter sees Vercel's egress IP instead of the caller. That leaves each account
-- unprotected AND turns the shared bucket into a lever — one attacker exhausting
-- it locks every real user out.
--
-- Apply in the Supabase SQL editor (or `supabase db push`) BEFORE deploying the
-- code that calls it: register_auth_attempt fails open, so until the function
-- exists the endpoints are simply unthrottled.

CREATE TABLE IF NOT EXISTS auth_attempts (
  key TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL DEFAULT 0,
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  blocked_until TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_auth_attempts_window ON auth_attempts(window_started_at);

-- Nothing but the service role ever touches this table.
ALTER TABLE auth_attempts ENABLE ROW LEVEL SECURITY;

/**
 * Count one attempt against every key and report when the caller may try again.
 *
 * Returns the blocked-until timestamp (the latest across all keys), or NULL when
 * the caller is still under the limit. Counting and blocking happen in one
 * statement per key because concurrency IS the attack: a read-then-write from the
 * application would let a burst of parallel requests all read the same count.
 */
CREATE OR REPLACE FUNCTION register_auth_attempt(
  p_keys TEXT[],
  p_limit INTEGER,
  p_window INTERVAL,
  p_block INTERVAL
)
RETURNS TIMESTAMPTZ AS $$
DECLARE
  v_key TEXT;
  v_blocked_until TIMESTAMPTZ;
  v_result TIMESTAMPTZ := NULL;
BEGIN
  -- Opportunistic cleanup: rows go stale as soon as their window closes.
  DELETE FROM auth_attempts
  WHERE window_started_at < NOW() - INTERVAL '1 day'
    AND (blocked_until IS NULL OR blocked_until < NOW());

  FOREACH v_key IN ARRAY p_keys LOOP
    -- `starts_over` is repeated in all three branches on purpose: a closed window
    -- OR a block that has just run out both mean "begin a fresh count". Without
    -- the second half, a block shorter than the window would re-trigger on the
    -- very next attempt, because the old over-limit count is still standing.
    INSERT INTO auth_attempts (key, attempts, window_started_at)
    VALUES (v_key, 1, NOW())
    ON CONFLICT (key) DO UPDATE SET
      attempts = CASE
        WHEN auth_attempts.window_started_at < NOW() - p_window
          OR auth_attempts.blocked_until <= NOW()
          THEN 1
        ELSE auth_attempts.attempts + 1
      END,
      window_started_at = CASE
        WHEN auth_attempts.window_started_at < NOW() - p_window
          OR auth_attempts.blocked_until <= NOW()
          THEN NOW()
        ELSE auth_attempts.window_started_at
      END,
      blocked_until = CASE
        -- An active block stands until it expires, however quiet the caller goes.
        WHEN auth_attempts.blocked_until > NOW()
          THEN auth_attempts.blocked_until
        WHEN auth_attempts.window_started_at < NOW() - p_window
          OR auth_attempts.blocked_until <= NOW()
          THEN NULL
        WHEN auth_attempts.attempts + 1 > p_limit
          THEN NOW() + p_block
        ELSE NULL
      END
    RETURNING auth_attempts.blocked_until INTO v_blocked_until;

    IF v_blocked_until IS NOT NULL AND v_blocked_until > NOW() THEN
      IF v_result IS NULL OR v_blocked_until > v_result THEN
        v_result := v_blocked_until;
      END IF;
    END IF;
  END LOOP;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

/** Forget the attempts for these keys — called after a successful sign-in so a
 *  few typos before the right password don't count toward a lockout. */
CREATE OR REPLACE FUNCTION clear_auth_attempts(p_keys TEXT[])
RETURNS VOID AS $$
BEGIN
  DELETE FROM auth_attempts WHERE key = ANY(p_keys);
END;
$$ LANGUAGE plpgsql;

-- PostgREST exposes every public function to anon/authenticated by default.
-- Left alone, anyone holding the (public) anon key could call these directly and
-- lock any email out at will, or clear their own lockout.
REVOKE EXECUTE ON FUNCTION register_auth_attempt(TEXT[], INTEGER, INTERVAL, INTERVAL) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION clear_auth_attempts(TEXT[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION register_auth_attempt(TEXT[], INTEGER, INTERVAL, INTERVAL) TO service_role;
GRANT EXECUTE ON FUNCTION clear_auth_attempts(TEXT[]) TO service_role;
