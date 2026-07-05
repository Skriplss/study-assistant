import { NextRequest, NextResponse } from 'next/server'
import { AnalyticsService } from '@/lib/services/AnalyticsService'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const {
      data: { user },
      error: authError,
    } = await getSupabaseAdmin().auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const timeRange = (searchParams.get('range') as '7d' | '30d' | '90d' | '1y') || '30d'

    const summary = await AnalyticsService.getSummary(user.id, timeRange)

    return NextResponse.json(summary)
  } catch (error) {
    console.error('Get summary error:', error)
    return NextResponse.json({ error: 'Failed to get summary' }, { status: 500 })
  }
}
