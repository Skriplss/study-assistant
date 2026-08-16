import { NextRequest, NextResponse } from 'next/server'
import { GraphService } from '@/lib/services/GraphService'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { registerAttempt, userKeys, AI_RULE } from '@/lib/auth/throttle'

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

    // One press of "Analyze Connections" walks the whole library — the heaviest
    // thing a single request can ask for here.
    const retryAfter = await registerAttempt(
      userKeys('graph-analyze', user.id),
      AI_RULE
    )
    if (retryAfter) {
      return NextResponse.json(
        { error: 'Too many requests. Give it a minute.' },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      )
    }

    await GraphService.analyzeConnections(user.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Analyze connections error:', error)
    return NextResponse.json(
      { error: 'Failed to analyze connections' },
      { status: 500 }
    )
  }
}
