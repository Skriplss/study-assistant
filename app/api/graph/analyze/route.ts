import { NextRequest, NextResponse } from 'next/server'
import { GraphService } from '@/lib/services/GraphService'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await getSupabaseAdmin().auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
