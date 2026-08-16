import { NextRequest, NextResponse } from 'next/server'
import { QuizService } from '@/lib/services/QuizService'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { errorResponse } from '@/lib/api/response'
import { registerAttempt, userKeys, AI_RULE } from '@/lib/auth/throttle'
export async function POST(request: NextRequest) {
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

    const retryAfter = await registerAttempt(
      userKeys('quiz-generate', user.id),
      AI_RULE
    )
    if (retryAfter) {
      return NextResponse.json(
        { error: 'Too many requests. Give it a minute.' },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      )
    }

    const body = await request.json()
    const { materialId, questionCount, difficulty, questionTypes, language } =
      body

    if (!materialId || !questionCount) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const quiz = await QuizService.createQuiz(user.id, materialId, {
      questionCount,
      difficulty: difficulty || 'mixed',
      questionTypes: questionTypes || ['multiple_choice', 'open_ended'],
      // Honor an explicitly requested language; otherwise let QuizService fall
      // back to the material's own detected language.
      language: typeof language === 'string' && language ? language : undefined,
    })

    return NextResponse.json({ quiz }, { status: 201 })
  } catch (error) {
    console.error('Generate quiz error:', error)
    return errorResponse(error, 'Failed to generate quiz')
  }
}
