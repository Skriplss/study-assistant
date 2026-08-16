import { NextRequest, NextResponse } from 'next/server'
import { QuizService } from '@/lib/services/QuizService'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { errorResponse } from '@/lib/api/response'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params
    const results = await QuizService.getResults(user.id, id)

    return NextResponse.json(results, { status: 200 })
  } catch (error) {
    console.error('Get results error:', error)
    // Not-found comes through as ApiError(404); anything else is a real 500 —
    // forcing 404 here hid genuine failures.
    return errorResponse(error, 'Failed to load quiz results')
  }
}
