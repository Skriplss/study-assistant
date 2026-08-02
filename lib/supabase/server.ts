import 'server-only'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { Database } from './database.types'

let adminClient: SupabaseClient<Database> | null = null

function getEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()

  if (!url || !serviceRoleKey) {
    throw new Error(
      'Missing Supabase server environment variables. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env, then restart `npm run dev`.'
    )
  }

  return { url, serviceRoleKey }
}

/** Service-role client for API routes only (never import from client components).
 * NEVER call session-creating auth methods (signInWithPassword/signUp/signOut) on
 * this client: GoTrueClient caches the resulting user session in memory even with
 * persistSession: false, and PostgREST then sends that user's JWT instead of the
 * service key on every later query in the process — silently re-enabling RLS. */
export function getSupabaseAdmin(): SupabaseClient<Database> {
  if (!adminClient) {
    const { url, serviceRoleKey } = getEnv()
    adminClient = createClient<Database>(url, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  }
  return adminClient
}

/** Throwaway anon-key client for auth flows (sign-in/sign-up). A fresh instance
 * per call so the session it acquires can't leak into anyone else's request. */
export function getSupabaseAuthClient(): SupabaseClient<Database> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  if (!url || !anonKey) {
    throw new Error(
      'Missing Supabase environment variables. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.'
    )
  }
  return createClient<Database>(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
