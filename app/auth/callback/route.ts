import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type')
  const next = searchParams.get('next') || '/dashboard'

  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as any,
    })

    if (!error) {
      return NextResponse.redirect(new URL(next, request.url))
    }
  }

  // If verification failed or no token, redirect to login
  return NextResponse.redirect(new URL('/auth/login?error=verification_failed', request.url))
}
