import { NextRequest, NextResponse } from 'next/server'
import { ReviewService } from '@/lib/services/ReviewService'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const requested = Number(searchParams.get('limit'))
    const limit = Number.isFinite(requested) ? Math.min(Math.max(requested, 1), 50) : 20

    // countDue is the whole backlog; cards are just the slice for this session.
    const [cards, dueCount] = await Promise.all([
      ReviewService.getDue(user.id, limit),
      ReviewService.countDue(user.id),
    ])

    return NextResponse.json({ cards, dueCount }, { status: 200 })
  } catch (error) {
    console.error('Load due reviews error:', error)
    const message = error instanceof Error ? error.message : 'Failed to load reviews'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
