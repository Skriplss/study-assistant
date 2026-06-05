import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { clearSessionCookies } from '@/lib/auth/session-cookies'

export async function POST() {
  try {
    const { error } = await supabase.auth.signOut()

    if (error) {
      console.error('Logout error:', error)
      return NextResponse.json(
        { error: 'Failed to logout' },
        { status: 500 }
      )
    }

    const response = NextResponse.json(
      { message: 'Logout successful' },
      { status: 200 }
    )
    return clearSessionCookies(response)
  } catch (error) {
    console.error('Logout error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
