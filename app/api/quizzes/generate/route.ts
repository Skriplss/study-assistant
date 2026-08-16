import { NextRequest, NextResponse } from 'next/server'
import { QuizService } from '@/lib/services/QuizService'
import { AIService } from '@/lib/services/AIService'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { errorResponse } from '@/lib/api/response'
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

    if (!materialId || typeof materialId !== 'string') {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // The 5–50 range was enforced only by a button's disabled state, and the
    // check here was a truthiness test — which both -100 and 0.5 pass. A negative
    // count made `questions.slice(0, count)` return nothing, so the quiz was
    // stored with total_questions 0 and later scored (0/0)*100 = NaN, which
    // serialises to null. Bound it where it cannot be skipped.
    if (
      !Number.isInteger(questionCount) ||
      questionCount < AIService.MIN_QUESTIONS ||
      questionCount > AIService.MAX_QUESTIONS
    ) {
      return NextResponse.json(
        {
          error: `questionCount must be a whole number between ${AIService.MIN_QUESTIONS} and ${AIService.MAX_QUESTIONS}`,
        },
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
