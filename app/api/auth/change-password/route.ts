import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { validatePassword } from '@/lib/auth/password-validation'

/**
 * Set a new password for the caller's own account.
 *
 * This exists so the password rules are enforced somewhere that isn't the
 * browser. Sign-up checked them server-side; the reset screen called
 * `supabase.auth.updateUser` straight from the page, so the rules there were a
 * suggestion — disable JavaScript, or POST to Supabase yourself, and only
 * Supabase's own minimum length applied.
 *
 * Authorization is the Bearer token, exactly as it was before: whoever holds a
 * valid access token for the account (which is what the emailed recovery link
 * hands the browser) can set its password. That is unchanged — the current
 * password was never required on this path.
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.substring(7)
    const {
      data: { user },
      error: authError,
    } = await getSupabaseAdmin().auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    const password = typeof body?.password === 'string' ? body.password : ''

    const validation = validatePassword(password)
    if (!validation.isValid) {
      return NextResponse.json(
        {
          error: 'Password does not meet requirements',
          details: validation.errors,
        },
        { status: 400 }
      )
    }

    const { error } = await getSupabaseAdmin().auth.admin.updateUserById(
      user.id,
      { password }
    )

    if (error) {
      console.error('Change password error:', error)
      return NextResponse.json(
        { error: 'Could not update the password' },
        { status: 400 }
      )
    }

    return NextResponse.json({ message: 'Password updated' }, { status: 200 })
  } catch (error) {
    console.error('Change password error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
