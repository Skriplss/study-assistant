import { NextResponse } from 'next/server'
import { clearSessionCookies } from '@/lib/auth/session-cookies'

// The browser client revokes the Supabase session itself (signOut in
// lib/auth/session.tsx); this route only clears the httpOnly cookies.
// Never call auth.signOut() on the shared admin client here — it signs out
// whichever user's session that process happens to have cached.
export async function POST() {
  const response = NextResponse.json(
    { message: 'Logout successful' },
    { status: 200 }
  )
  return clearSessionCookies(response)
}
