import { NextRequest, NextResponse } from 'next/server'
import { QuizService } from '@/lib/services/QuizService'
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

    const body = await request.json()
    const { materialId, questionCount, difficulty, questionTypes, language } = body

    if (!materialId || !questionCount) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const quiz = await QuizService.createQuiz(user.id, materialId, {
      questionCount,
      difficulty: difficulty || 'mixed',
      questionTypes: questionTypes || ['multiple_choice', 'open_ended'],
      language: ['sk', 'en', 'ru'].includes(language) ? language : 'en',
    })

    return NextResponse.json({ quiz }, { status: 201 })
  } catch (error: any) {
    console.error('Generate quiz error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
