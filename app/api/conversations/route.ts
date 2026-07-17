import { NextRequest, NextResponse } from 'next/server'
import { ConversationService } from '@/lib/services/ConversationService'
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

    const conversations = await ConversationService.list(user.id)

    return NextResponse.json({ conversations }, { status: 200 })
  } catch (error) {
    console.error('List conversations error:', error)
    const message = error instanceof Error ? error.message : 'Failed to load conversations'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
