import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(
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
    const db = getSupabaseAdmin()

    const { data: quiz } = await db
      .from('quizzes')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (!quiz) {
      return NextResponse.json({ error: 'Quiz not found' }, { status: 404 })
    }

    const { data: answers } = await db
      .from('answers')
      .select('*')
      .eq('quiz_id', id)
      .order('answered_at')

    return NextResponse.json({
      quizId: quiz.id,
      score: quiz.score,
      correctCount: answers?.filter(a => a.is_correct).length || 0,
      totalQuestions: quiz.total_questions,
      answers: answers?.map(a => ({
        id: a.id,
        questionId: a.question_id,
        userAnswer: a.user_answer,
        isCorrect: a.is_correct,
        feedback: a.feedback,
        answeredAt: a.answered_at,
      })) || [],
      completedAt: quiz.completed_at,
    })
  } catch (error) {
    console.error('Get results error:', error)
    return NextResponse.json(
      { error: 'Failed to get results' },
      { status: 500 }
    )
  }
}
