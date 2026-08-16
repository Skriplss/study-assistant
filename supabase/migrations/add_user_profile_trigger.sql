-- Create the user_profiles row from the database, not from the signup route.
--
-- Why: `POST /api/auth/signup` inserted the profile itself and only logged a
-- failure, so a rejected insert produced an account with no profile and a 201.
-- But the bigger hole was that OAuth never goes through that route at all —
-- Google sign-in lands on /auth/oauth-callback and the profile step simply never
-- runs. Measured on production: 11 users, 7 profiles; 3 of the 4 missing ones
-- had signed in with Google.
--
-- A trigger on auth.users covers every path there is — email, OAuth, magic link,
-- an admin creating a user by hand — and cannot be forgotten by a future one.
--
-- Apply in the Supabase SQL editor (or `supabase db push`).

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
-- SECURITY DEFINER because the inserting role is GoTrue's, which has no rights
-- on public.user_profiles.
SECURITY DEFINER
-- Pin the schema path: a SECURITY DEFINER function without one resolves
-- unqualified names against the caller's search_path.
SET search_path = public
AS $$
BEGIN
  -- ON CONFLICT, not a plain INSERT: this runs inside the auth.users insert, so
  -- raising here would fail the sign-up itself. A profile that already exists
  -- (the signup route used to create one) must be a no-op, never an error.
  INSERT INTO user_profiles (id, preferences)
  VALUES (NEW.id, '{}'::jsonb)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Backfill the accounts that predate the trigger.
INSERT INTO user_profiles (id, preferences)
SELECT id, '{}'::jsonb FROM auth.users
ON CONFLICT (id) DO NOTHING;
