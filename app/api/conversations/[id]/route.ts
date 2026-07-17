import { NextRequest, NextResponse } from 'next/server'
import { ConversationService } from '@/lib/services/ConversationService'
import { getSupabaseAdmin } from '@/lib/supabase/server'

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

// "Conversation not found" is what the service throws for both a missing row and
// someone else's — deliberately indistinguishable, so it maps to one 404.
const statusFor = (message: string) => (message === 'Conversation not found' ? 404 : 500)

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
    const message = error instanceof Error ? error.message : 'Failed to load conversation'
    return NextResponse.json({ error: message }, { status: statusFor(message) })
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
    const message = error instanceof Error ? error.message : 'Failed to delete conversation'
    return NextResponse.json({ error: message }, { status: statusFor(message) })
  }
}
