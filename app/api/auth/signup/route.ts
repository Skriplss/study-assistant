import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAuthClient } from '@/lib/supabase/server'
import { validatePassword } from '@/lib/auth/password-validation'
import { applySessionCookies } from '@/lib/auth/session-cookies'
import { attemptKeys, registerAttempt, SIGNUP_RULE } from '@/lib/auth/throttle'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password, name } = body

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      )
    }

    const passwordValidation = validatePassword(password)
    if (!passwordValidation.isValid) {
      return NextResponse.json(
        {
          error: 'Password does not meet requirements',
          details: passwordValidation.errors,
        },
        { status: 400 }
      )
    }

    // Throttled on the address alone — the email is new by definition, so there
    // is no account to protect here, only bulk registration to slow down.
    const retryAfter = await registerAttempt(
      attemptKeys('signup', request),
      SIGNUP_RULE
    )
    if (retryAfter) {
      return NextResponse.json(
        { error: 'Too many attempts. Try again later.' },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      )
    }

    // Sign up on a throwaway client, never the shared admin one (see
    // getSupabaseAdmin's warning about in-memory session adoption).
    const { data, error } = await getSupabaseAuthClient().auth.signUp({
      email,
      password,
      options: {
        data: { name: name || null },
      },
    })

    if (error) {
      return NextResponse.json(
        { error: error.message || 'Failed to create account' },
        { status: 400 }
      )
    }

    if (!data.user) {
      return NextResponse.json(
        { error: 'Failed to create user' },
        { status: 500 }
      )
    }

    // The profile row is created by the on_auth_user_created trigger (see
    // supabase/migrations/add_user_profile_trigger.sql). Doing it here as well
    // covered only this route — Google sign-in never reaches it — and swallowed
    // its own failure, which is how four accounts ended up without a profile.

    const response = NextResponse.json(
      {
        message: 'Account created successfully',
        user: {
          id: data.user.id,
          email: data.user.email,
        },
        session: data.session,
      },
      { status: 201 }
    )

    if (data.session) {
      return applySessionCookies(response, data.session)
    }

    return response
  } catch (error) {
    console.error('Signup error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
