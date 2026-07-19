import { NextRequest, NextResponse } from 'next/server'
import { ConversationService } from '@/lib/services/ConversationService'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { errorResponse } from '@/lib/api/response'

async function authenticate(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null

  const token = authHeader.substring(7)
  const {
    data: { user },
    error,
  } = await getSupabaseAdmin().auth.getUser(token)

  return error || !user ? null : user
}

// The service throws ApiError('Conversation not found', 404) for both a missing
// row and someone else's — deliberately indistinguishable, so both map to 404
// via errorResponse rather than revealing which case it was.

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await authenticate(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const messages = await ConversationService.getMessages(user.id, id)

    return NextResponse.json({ messages }, { status: 200 })
  } catch (error) {
    console.error('Load conversation error:', error)
    return errorResponse(error, 'Failed to load conversation')
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await authenticate(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    await ConversationService.remove(user.id, id)

    return NextResponse.json({ message: 'Conversation deleted' }, { status: 200 })
  } catch (error) {
    console.error('Delete conversation error:', error)
    return errorResponse(error, 'Failed to delete conversation')
  }
}
