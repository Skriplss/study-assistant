import { NextRequest, NextResponse } from 'next/server'
import { ReviewService } from '@/lib/services/ReviewService'
import { getSupabaseAdmin } from '@/lib/supabase/server'

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

    const body = await request.json()
    const { questionId, userAnswer } = body

    if (!questionId || typeof userAnswer !== 'string') {
      return NextResponse.json(
        { error: 'questionId and userAnswer are required' },
        { status: 400 }
      )
    }

    const result = await ReviewService.grade(user.id, questionId, userAnswer)

    return NextResponse.json(result, { status: 200 })
  } catch (error) {
    console.error('Grade review error:', error)
    const message = error instanceof Error ? error.message : 'Failed to grade review'
    const status = message === 'Review item not found' ? 404 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
