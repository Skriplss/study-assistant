import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/config/admin'

const TYPES = ['bug', 'idea', 'other'] as const
const STATUSES = ['new', 'seen', 'resolved'] as const
const MAX_MESSAGE = 5000

/** Resolve the Bearer user, or null. */
async function getUser(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return null
  const token = authHeader.replace('Bearer ', '')
  const { data: { user } } = await getSupabaseAdmin().auth.getUser(token)
  return user
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const type = TYPES.includes(body.type) ? body.type : 'bug'
    const message = typeof body.message === 'string' ? body.message.trim() : ''

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    // `feedback` isn't in the generated database.types yet — cast until it's
    // regenerated (same pattern as other recent tables in this codebase).
    const { error } = await (getSupabaseAdmin() as any).from('feedback').insert({
      user_id: user.id,
      type,
      message: message.slice(0, MAX_MESSAGE),
      page_url: typeof body.pageUrl === 'string' ? body.pageUrl.slice(0, 500) : null,
      user_agent: request.headers.get('user-agent')?.slice(0, 500) ?? null,
    })

    if (error) throw new Error(error.message)

    return NextResponse.json({ success: true }, { status: 201 })
  } catch (error: any) {
    console.error('Submit feedback error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// Admin-only: list all reports, newest first.
export async function GET(request: NextRequest) {
  try {
    const user = await getUser(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!isAdmin(user.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { data, error } = await (getSupabaseAdmin() as any)
      .from('feedback')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw new Error(error.message)

    return NextResponse.json({ feedback: data ?? [] }, { status: 200 })
  } catch (error: any) {
    console.error('List feedback error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// Admin-only: update a report's status.
export async function PATCH(request: NextRequest) {
  try {
    const user = await getUser(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!isAdmin(user.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await request.json()
    if (!body.id || !STATUSES.includes(body.status)) {
      return NextResponse.json({ error: 'Invalid id or status' }, { status: 400 })
    }

    const { error } = await (getSupabaseAdmin() as any)
      .from('feedback')
      .update({ status: body.status })
      .eq('id', body.id)

    if (error) throw new Error(error.message)

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error: any) {
    console.error('Update feedback error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
