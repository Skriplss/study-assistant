import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAuthClient } from '@/lib/supabase/server'
import type { EmailOtpType } from '@supabase/supabase-js'

const OTP_TYPES: EmailOtpType[] = [
  'signup',
  'invite',
  'magiclink',
  'recovery',
  'email_change',
  'email',
]

/**
 * `next` arrives in the query string, so it is attacker-controlled. Passing it to
 * `new URL(next, base)` unchecked turns this into an open redirect: an absolute
 * URL wins over the base entirely, and `//host` is absolute too. A link on our
 * own domain that lands on someone else's is exactly what phishing wants.
 */
function safeNext(next: string | null): string {
  if (!next || !next.startsWith('/') || next.startsWith('//'))
    return '/dashboard'
  return next
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type')

  if (token_hash && type && OTP_TYPES.includes(type as EmailOtpType)) {
    // A fresh client per request, never a module-level one: verifyOtp creates a
    // session, and GoTrue caches it in memory even with persistSession off — a
    // shared instance would hand that session to whoever asks next.
    const { error } = await getSupabaseAuthClient().auth.verifyOtp({
      token_hash,
      type: type as EmailOtpType,
    })

    if (!error) {
      return NextResponse.redirect(
        new URL(safeNext(searchParams.get('next')), request.url)
      )
    }
  }

  // If verification failed or no token, redirect to login
  return NextResponse.redirect(
    new URL('/auth/login?error=verification_failed', request.url)
  )
}
