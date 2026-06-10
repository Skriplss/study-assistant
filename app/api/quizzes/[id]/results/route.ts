import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get('session')?.value

    if (!sessionCookie) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const session = JSON.parse(sessionCookie)
    const db = getSupabaseAdmin()
    const { id } = await params

    const { data: quiz } = await db
      .from('quizzes')
      .select('*')
      .eq('id', id)
      .eq('user_id', session.userId)
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
