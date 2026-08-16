import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, getSupabaseAuthClient } from '@/lib/supabase/server'
import { applySessionCookies } from '@/lib/auth/session-cookies'
import {
  attemptKeys,
  registerAttempt,
  clearAttempts,
  emailKeyOnly,
  LOGIN_RULE,
} from '@/lib/auth/throttle'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = body

    // Validate required fields
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    // Count the attempt BEFORE asking Supabase, so a burst of parallel guesses
    // can't all slip past on the same pre-read count.
    const throttleKeys = attemptKeys('login', request, email)
    const retryAfter = await registerAttempt(throttleKeys, LOGIN_RULE)
    if (retryAfter) {
      return NextResponse.json(
        { error: 'Too many attempts. Try again later.' },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      )
    }

    // Attempt to sign in — on a throwaway client, never the shared admin one
    // (see getSupabaseAdmin's warning about in-memory session adoption).
    const { data, error } =
      await getSupabaseAuthClient().auth.signInWithPassword({
        email,
        password,
      })

    if (error) {
      console.error('Login error:', error)

      // Return generic error for security
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    if (!data.user || !data.session) {
      return NextResponse.json({ error: 'Login failed' }, { status: 401 })
    }

    // Right password — forget this account's failures, so a few typos before it
    // don't stack up toward a lockout across the day. The IP counter deliberately
    // survives: clearing it would hand anyone with one working account a way to
    // reset their guessing budget against everyone else's.
    await clearAttempts(emailKeyOnly(throttleKeys))

    // Get user profile
    const { data: profile } = await getSupabaseAdmin()
      .from('user_profiles')
      .select('*')
      .eq('id', data.user.id)
      .single()

    const response = NextResponse.json(
      {
        message: 'Login successful',
        user: {
          id: data.user.id,
          email: data.user.email,
          profile: profile || null,
        },
        session: data.session,
      },
      { status: 200 }
    )

    return applySessionCookies(response, data.session)
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
