import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { AIService } from '@/lib/services/AIService'
import { selectRelevantContent } from '@/lib/ai/context'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: materialId } = await params

    // Get authorization token
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.substring(7)
    const supabase = getSupabaseAdmin()

    // Verify token and get user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse request body
    const body = await req.json()
    const { message, history = [] } = body

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      )
    }

    // Fetch material and verify ownership
    const { data: material, error: materialError } = await supabase
      .from('study_materials')
      .select('*')
      .eq('id', materialId)
      .eq('user_id', user.id)
      .single()

    if (materialError || !material) {
      return NextResponse.json({ error: 'Material not found' }, { status: 404 })
    }

    // Check if material has been parsed
    if (!material.parsed_content || material.parsing_status !== 'completed') {
      return NextResponse.json(
        { error: 'Material must be parsed before chatting' },
        { status: 400 }
      )
    }

    // Only send the passages most relevant to the question — sending the whole
    // document blows past Groq's free-tier tokens-per-minute limit.
    const relevantContent = selectRelevantContent(material.parsed_content, message)

    // Build system prompt with material content
    const systemPrompt = `You are a helpful study assistant. Answer questions based ONLY on the following material: "${material.title}".

Material content:
${relevantContent}

Instructions:
- Be concise and clear in your answers
- Only use information from the material provided above
- If the answer is not in the material, say "I don't find that information in this material"
- Help the user understand the concepts better
- You can explain, summarize, or clarify content from the material`

    // Build conversation messages for AI
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = []

    // Add system context as first user message (since Gemini doesn't have system role)
    messages.push({ role: 'user', content: systemPrompt })
    messages.push({
      role: 'assistant',
      content:
        'I understand. I will answer questions based only on the provided material.',
    })

    // Add conversation history (keep last 10 messages)
    const recentHistory = (history as ChatMessage[]).slice(-10)
    messages.push(...recentHistory)

    // Add current user message
    messages.push({ role: 'user', content: message })

    // Stream the answer token-by-token so the user sees it as it generates,
    // instead of waiting for the full completion. Higher-TPM Groq model since
    // chat carries material context.
    const encoder = new TextEncoder()
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const delta of AIService.streamChat(messages, {
            model: 'meta-llama/llama-4-scout-17b-16e-instruct',
          })) {
            controller.enqueue(encoder.encode(delta))
          }
        } catch (err) {
          console.error('Chat stream error:', err)
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
      },
    })
  } catch (error: any) {
    console.error('Chat error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to process chat message' },
      { status: 500 }
    )
  }
}
