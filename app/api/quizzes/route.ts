import { NextRequest, NextResponse } from 'next/server'
import { QuizService } from '@/lib/services/QuizService'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
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

    const quizzes = await QuizService.listQuizzes(user.id)

    return NextResponse.json({ quizzes }, { status: 200 })
  } catch (error: any) {
    console.error('List quizzes error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
