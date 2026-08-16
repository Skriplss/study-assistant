import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { AIService } from '@/lib/services/AIService'
import { ConversationService } from '@/lib/services/ConversationService'
import { GlobalChatService } from '@/lib/services/GlobalChatService'
import { getUserFriendlyAIError } from '@/lib/ai/errors'
import { errorResponse } from '@/lib/api/response'
import { registerAttempt, userKeys, AI_RULE } from '@/lib/auth/throttle'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

/** Generous for a question, far below what would blow the shared TPM budget. */
const MAX_MESSAGE_CHARS = 4000

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.substring(7)
    const supabase = getSupabaseAdmin()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const retryAfter = await registerAttempt(userKeys('chat', user.id), AI_RULE)
    if (retryAfter) {
      return NextResponse.json(
        { error: 'Too many requests. Give it a minute.' },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      )
    }

    const body = await req.json()
    const { message, history = [], materialId, conversationId } = body

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      )
    }

    // Everything below is client-supplied and goes into a prompt billed against
    // an 8k-token-per-minute budget shared by every user at once, so size is not
    // a cosmetic concern here.
    if (message.length > MAX_MESSAGE_CHARS) {
      return NextResponse.json(
        { error: 'That message is too long.' },
        { status: 400 }
      )
    }

    // `history` was spread into the messages array untyped: a string spread into
    // four bare characters and reached Groq as malformed turns, a number threw
    // on .slice and became a 500.
    const priorTurns = Array.isArray(history)
      ? history
          .filter(
            (turn): turn is ChatMessage =>
              !!turn &&
              typeof turn === 'object' &&
              typeof (turn as ChatMessage).content === 'string' &&
              ((turn as ChatMessage).role === 'user' ||
                (turn as ChatMessage).role === 'assistant')
          )
          .slice(-4)
          .map((turn) => ({
            role: turn.role,
            content: turn.content.slice(0, MAX_MESSAGE_CHARS),
          }))
      : []

    const scopeId =
      typeof materialId === 'string' && materialId ? materialId : undefined

    // Resolve the conversation before answering, so the id can ride out on the
    // response headers — the body is a stream and can't carry it.
    let activeConversationId: string
    if (typeof conversationId === 'string' && conversationId) {
      await ConversationService.assertOwned(user.id, conversationId)
      activeConversationId = conversationId
    } else {
      activeConversationId = await ConversationService.create(
        user.id,
        message,
        scopeId
      )
    }

    await ConversationService.appendMessage(
      activeConversationId,
      'user',
      message
    )

    const { context, sources } = await GlobalChatService.buildContext(
      user.id,
      message,
      scopeId
    )
    const encoder = new TextEncoder()
    const sourcesHeader = encodeURIComponent(JSON.stringify(sources))
    const responseHeaders = {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Chat-Sources': sourcesHeader,
      'X-Conversation-Id': activeConversationId,
    }

    // No parsed materials to draw from — reply directly instead of calling the model.
    if (sources.length === 0) {
      const canned =
        "I don't have any parsed materials to answer from yet. Upload and parse some materials first, then ask again."

      await ConversationService.appendMessage(
        activeConversationId,
        'assistant',
        canned
      )

      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode(canned))
          controller.close()
        },
      })
      return new Response(stream, { headers: responseHeaders })
    }

    const systemPrompt = `You are a study assistant that answers questions using the user's own study materials. Use ONLY the sources below.

Sources:
${context}

Instructions:
- Answer using only the information in the sources above.
- When you use a source, mention it by its title so the user knows where it came from.
- If the sources don't contain the answer, say so plainly instead of guessing.
- Be concise and clear. Explain, summarize, or connect ideas across the sources when helpful.`

    const messages: ChatMessage[] = []
    messages.push({ role: 'user', content: systemPrompt })
    messages.push({
      role: 'assistant',
      content:
        'Understood. I will answer using only the provided sources and cite them by title.',
    })
    // Two exchanges. Every turn re-sends the sources, so history is the one part
    // of the prompt that grows unboundedly — at ~600 tokens per past answer, ten
    // messages cost more TPM than the sources themselves.
    messages.push(...priorTurns)
    messages.push({ role: 'user', content: message })

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        // The reply only exists as deltas, so accumulate it to persist at the
        // end. A client that disconnects mid-stream loses the assistant turn —
        // the user's question is already saved either way.
        let answer = ''
        try {
          for await (const delta of AIService.streamChat(messages, {
            model: AIService.LARGE_MODEL,
            // Sized to measured answers (~300-600 tokens) rather than headroom:
            // it counts against the same 8k TPM the sources are competing for.
            maxTokens: 900,
          })) {
            answer += delta
            controller.enqueue(encoder.encode(delta))
          }
        } catch (err) {
          console.error('Global chat stream error:', err)
          // Enqueued, not appended to `answer` — the notice is for this render
          // only and must not be persisted as the assistant turn.
          controller.enqueue(encoder.encode(`\n${getUserFriendlyAIError(err)}`))
        } finally {
          controller.close()

          if (answer) {
            await ConversationService.appendMessage(
              activeConversationId,
              'assistant',
              answer,
              sources
            ).catch((err) => {
              console.error('Failed to persist assistant message:', err)
            })
          }
        }
      },
    })

    return new Response(stream, { headers: responseHeaders })
  } catch (error) {
    console.error('Global chat error:', error)
    return errorResponse(error, 'Failed to process chat message')
  }
}
