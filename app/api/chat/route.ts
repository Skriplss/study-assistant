import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { AIService } from '@/lib/services/AIService'
import { GlobalChatService } from '@/lib/services/GlobalChatService'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

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

    const body = await req.json()
    const { message, history = [], materialId } = body

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    const scopeId = typeof materialId === 'string' && materialId ? materialId : undefined
    const { context, sources } = await GlobalChatService.buildContext(user.id, message, scopeId)
    const encoder = new TextEncoder()
    const sourcesHeader = encodeURIComponent(JSON.stringify(sources))

    // No parsed materials to draw from — reply directly instead of calling the model.
    if (sources.length === 0) {
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(
            encoder.encode(
              "I don't have any parsed materials to answer from yet. Upload and parse some materials first, then ask again."
            )
          )
          controller.close()
        },
      })
      return new Response(stream, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          'X-Chat-Sources': sourcesHeader,
        },
      })
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
      content: 'Understood. I will answer using only the provided sources and cite them by title.',
    })
    messages.push(...(history as ChatMessage[]).slice(-10))
    messages.push({ role: 'user', content: message })

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const delta of AIService.streamChat(messages, {
            model: 'meta-llama/llama-4-scout-17b-16e-instruct',
          })) {
            controller.enqueue(encoder.encode(delta))
          }
        } catch (err) {
          console.error('Global chat stream error:', err)
          controller.enqueue(encoder.encode('\n[Error generating response]'))
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'X-Chat-Sources': sourcesHeader,
      },
    })
  } catch (error: any) {
    console.error('Global chat error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to process chat message' },
      { status: 500 }
    )
  }
}
