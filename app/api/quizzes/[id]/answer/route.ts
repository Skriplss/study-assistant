import { NextRequest, NextResponse } from 'next/server'
import { QuizService } from '@/lib/services/QuizService'
import { getSupabaseAdmin } from '@/lib/supabase/server'
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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
  } catch (error: any) {
    console.error('Submit answer error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
