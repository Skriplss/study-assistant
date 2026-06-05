import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 404 })
  }

  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Missing Authorization header' }, { status: 400 })
    }

    const token = authHeader.replace('Bearer ', '')

    const supabaseResult = await getSupabaseAdmin().auth.getUser(token).catch((e) => ({ error: e }))
    const adminResult = await supabaseAdmin.auth.getUser(token).catch((e) => ({ error: e }))

    return NextResponse.json({ supabase: supabaseResult, supabaseAdmin: adminResult }, { status: 200 })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
