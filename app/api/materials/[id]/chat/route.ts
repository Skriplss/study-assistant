import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { AIService } from '@/lib/services/AIService'

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
      return NextResponse.json(
        { error: 'Material not found' },
        { status: 404 }
      )
    }

    // Check if material has been parsed
    if (!material.parsed_content || material.parsing_status !== 'completed') {
      return NextResponse.json(
        { error: 'Material must be parsed before chatting' },
        { status: 400 }
      )
    }

    // Build system prompt with material content
    const systemPrompt = `You are a helpful study assistant. Answer questions based ONLY on the following material: "${material.title}".

Material content:
${material.parsed_content}

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
    messages.push({ role: 'assistant', content: 'I understand. I will answer questions based only on the provided material.' })
    
    // Add conversation history (keep last 10 messages)
    const recentHistory = (history as ChatMessage[]).slice(-10)
    messages.push(...recentHistory)
    
    // Add current user message
    messages.push({ role: 'user', content: message })

    // Call AI service
    let responseText: string

    try {
      // Try Gemini first
      responseText = await AIService.callWithRetry(async () => {
        const gemini = AIService.getGeminiClient()
        const model = gemini.getGenerativeModel({ model: 'gemini-2.0-flash' })
        
        // Convert messages to Gemini format
        const geminiMessages = messages.map((msg) => ({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }],
        }))
        
        const chat = model.startChat({
          history: geminiMessages.slice(0, -1),
        })
        
        const result = await chat.sendMessage(messages[messages.length - 1].content)
        const response = result.response
        return response.text()
      })
    } catch (geminiError: any) {
      console.log('Gemini error, falling back to Groq:', geminiError?.message)
      
      // Fallback to Groq
      responseText = await AIService.callWithRetry(async () => {
        const client = AIService.getGroqClient()
        const groqMessages = messages.map((msg) => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        }))
        
        const response = await client.chat.completions.create({
          model: 'llama-3.1-8b-instant',
          messages: groqMessages,
          temperature: 0.5,
          max_tokens: 1000,
        })
        
        return response.choices[0]?.message?.content || 'I could not generate a response.'
      })
    }

    return NextResponse.json({ message: responseText })
  } catch (error: any) {
    console.error('Chat error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to process chat message' },
      { status: 500 }
    )
  }
}
