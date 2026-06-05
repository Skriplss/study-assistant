import { NextRequest, NextResponse } from 'next/server'
import { applySessionCookies } from '@/lib/auth/session-cookies'
import type { Session } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { access_token, refresh_token, expires_in } = body

    if (!access_token || !refresh_token) {
      return NextResponse.json(
        { error: 'Session tokens are required' },
        { status: 400 }
      )
    }

    const session = {
      access_token,
      refresh_token,
      expires_in: expires_in ?? 3600,
      token_type: 'bearer',
      user: null,
    } as Session

    const response = NextResponse.json({ message: 'Session synced' })
    return applySessionCookies(response, session)
  } catch {
    return NextResponse.json(
      { error: 'Failed to sync session' },
      { status: 500 }
    )
  }
}
