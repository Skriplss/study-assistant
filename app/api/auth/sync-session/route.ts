import { NextRequest, NextResponse } from 'next/server'
import { applySessionCookies } from '@/lib/auth/session-cookies'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import type { Session } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { access_token, refresh_token, expires_in } = body

    if (
      !access_token ||
      !refresh_token ||
      typeof access_token !== 'string' ||
      typeof refresh_token !== 'string'
    ) {
      return NextResponse.json(
        { error: 'Session tokens are required' },
        { status: 400 }
      )
    }

    // Never set auth cookies from unverified input — without this check any
    // cross-site POST could plant junk (or an attacker's session) in the
    // httpOnly cookies the proxy gates on.
    const {
      data: { user },
      error,
    } = await getSupabaseAdmin().auth.getUser(access_token)
    if (error || !user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    const session = {
      access_token,
      refresh_token,
      // Clamp to sane bounds — this value becomes the cookie maxAge.
      expires_in: Math.min(Math.max(Number(expires_in) || 3600, 60), 86400),
      token_type: 'bearer',
      user: null,
    } as unknown as Session

    const response = NextResponse.json({ message: 'Session synced' })
    return applySessionCookies(response, session)
  } catch {
    return NextResponse.json(
      { error: 'Failed to sync session' },
      { status: 500 }
    )
  }
}
