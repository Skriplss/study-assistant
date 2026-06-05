import type { Session } from '@supabase/supabase-js'

export async function fetchWithAuth(
  session: Session | null,
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const token = session?.access_token
  if (!token) {
    throw new Error('Not authenticated')
  }

  const headers = new Headers(init?.headers)
  headers.set('Authorization', `Bearer ${token}`)

  return fetch(input, {
    ...init,
    headers,
  })
}
