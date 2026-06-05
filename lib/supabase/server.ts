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

/** Service-role client for API routes only (never import from client components). */
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

/** @deprecated Use getSupabaseAdmin() */
export const supabaseAdmin = new Proxy({} as SupabaseClient<Database>, {
  get(_target, prop) {
    return Reflect.get(getSupabaseAdmin(), prop)
  },
})
