import { NextRequest, NextResponse } from 'next/server'
import { QuizService } from '@/lib/services/QuizService'
import { getSupabaseAdmin } from '@/lib/supabase/server'

type RouteParams = { params: Promise<{ id: string }> }

export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
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

    const { id } = await params
    const body = await request.json()
    const { questionId, answer } = body

    if (!questionId || !answer) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    const result = await QuizService.submitAnswer(user.id, id, questionId, answer)

    return NextResponse.json({ answer: result }, { status: 200 })
  } catch (error: unknown) {
    console.error('Submit answer error:', error)
    const message = error instanceof Error ? error.message : 'Failed to submit answer'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
