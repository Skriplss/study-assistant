import { NextRequest, NextResponse } from 'next/server'
import { GraphService } from '@/lib/services/GraphService'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.substring(7)
    const { data: { user }, error: authError } = await getSupabaseAdmin().auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const graph = await GraphService.getGraph(user.id)

    return NextResponse.json(graph)
  } catch (error) {
    console.error('Get graph error:', error)
    return NextResponse.json(
      { error: 'Failed to get graph' },
      { status: 500 }
    )
  }
}
