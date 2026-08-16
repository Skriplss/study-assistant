import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { attemptKeys, registerAttempt, SIGNUP_RULE } from '@/lib/auth/throttle'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email } = body

    // Validate required fields
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      )
    }

    // Unthrottled, this endpoint mails anyone, repeatedly, on demand — the sender
    // being us is the whole problem. Keyed on the target address too, so one
    // inbox can't be flooded from a handful of hosts.
    const retryAfter = await registerAttempt(
      attemptKeys('reset', request, email),
      SIGNUP_RULE
    )
    if (retryAfter) {
      return NextResponse.json(
        { error: 'Too many attempts. Try again later.' },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      )
    }

    // Send password reset email. Fall back to the request origin so a missing
    // NEXT_PUBLIC_APP_URL can't silently mail out an `undefined/...` link.
    const origin =
      process.env.NEXT_PUBLIC_APP_URL?.trim() || new URL(request.url).origin
    const { error } = await getSupabaseAdmin().auth.resetPasswordForEmail(
      email,
      {
        redirectTo: `${origin}/auth/reset-password/confirm`,
      }
    )

    if (error) {
      console.error('Password reset error:', error)
      // For security, don't reveal if email exists
      return NextResponse.json(
        {
          message:
            'If an account exists with this email, a password reset link has been sent',
        },
        { status: 200 }
      )
    }

    return NextResponse.json(
      { message: 'Password reset link has been sent to your email' },
      { status: 200 }
    )
  } catch (error) {
    console.error('Password reset error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
