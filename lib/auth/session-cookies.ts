import { NextResponse } from 'next/server'
import type { Session } from '@supabase/supabase-js'

const ACCESS_COOKIE = 'sb-access-token'
const REFRESH_COOKIE = 'sb-refresh-token'

export function applySessionCookies(
  response: NextResponse,
  session: Session
): NextResponse {
  const secure = process.env.NODE_ENV === 'production'

  response.cookies.set(ACCESS_COOKIE, session.access_token, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: session.expires_in ?? 60 * 60,
  })

  response.cookies.set(REFRESH_COOKIE, session.refresh_token, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  })

  return response
}

export function clearSessionCookies(response: NextResponse): NextResponse {
  response.cookies.delete(ACCESS_COOKIE)
  response.cookies.delete(REFRESH_COOKIE)
  return response
}
