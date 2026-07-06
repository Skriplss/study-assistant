import { GoogleGenerativeAI } from '@google/generative-ai'
import type {
  Quiz,
  Question,
  QuizConfig,
  AnswerVerification,
  GeneratedQuiz,
} from '@/lib/types'
import { buildQuizGenerationPrompt, buildAnswerVerificationPrompt } from '@/lib/ai/quiz-prompt'
import { AIServiceError } from '@/lib/ai/errors'

type FetchImpl = typeof fetch

interface GroqOptions {
  model: string
  temperature: number
  maxTokens: number
  /** Request a JSON object response (Groq json_object mode). */
  json?: boolean
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'

export class AIService {
  static gemini: GoogleGenerativeAI | null = null
  static readonly MAX_RETRIES = 3
  static readonly TIMEOUT = 45000
  static readonly RETRY_DELAYS = [1000, 2000, 4000]
  static readonly MIN_QUESTIONS = 5
  static readonly MAX_QUESTIONS = 50
  static readonly VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct'

  /** Injectable fetch for tests; defaults to global fetch. */
  private static fetchImpl: FetchImpl | null = null

  static setFetchImplementation(fn: FetchImpl): void {
    this.fetchImpl = fn
  }

  static resetFetchImplementation(): void {
    this.fetchImpl = null
  }

  private static getFetch(): FetchImpl {
    return this.fetchImpl ?? globalThis.fetch
  }

  static getGeminiClient(): GoogleGenerativeAI {
    if (!this.gemini) {
      const apiKey = process.env.GOOGLE_AI_API_KEY
      if (!apiKey) throw new AIServiceError('GOOGLE_AI_API_KEY not configured', 'config')
      this.gemini = new GoogleGenerativeAI(apiKey)
    }
    return this.gemini
  }

  // ---------------------------------------------------------------------------
  // Provider calls
  // ---------------------------------------------------------------------------

  /** Race a promise against a timeout, always clearing the timer (no leak). */
  private static withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    let timer: ReturnType<typeof setTimeout>
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new AIServiceError('Timeout', 'timeout')), ms)
    })
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
  }

  private static async callGemini(prompt: string): Promise<string> {
    return this.withTimeout(
      (async () => {
        const model = this.getGeminiClient().getGenerativeModel({
          model: 'gemini-2.0-flash',
          generationConfig: { responseMimeType: 'application/json' },
        })
        const result = await model.generateContent(prompt)
        return result.response.text()
      })(),
      this.TIMEOUT
    )
  }

  /** Low-level Groq chat POST. Maps transport/HTTP errors to AIServiceError. */
  private static async groqPost(body: object): Promise<string> {
    const apiKey = process.env.GROQ_API_KEY
    if (!apiKey) throw new AIServiceError('GROQ_API_KEY not configured', 'config')

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.TIMEOUT)

    let res: Response
    try {
      res = await this.getFetch()(GROQ_URL, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      })
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') {
        throw new AIServiceError('AI request timed out', 'timeout')
      }
      throw new AIServiceError((err as Error)?.message ?? 'Network error', 'unavailable')
    } finally {
      clearTimeout(timer)
    }

    if (!res.ok) throw await this.toHttpError(res)

    const responseBody = await res.json()
    const text = responseBody?.choices?.[0]?.message?.content
    if (!text) throw new AIServiceError('Empty response from Groq', 'parse')
    return text
  }

  /** Single Groq HTTP attempt for a text chat completion. */
  private static async callGroqOnce(messages: ChatMessage[], opts: GroqOptions): Promise<string> {
    return this.groqPost({
      model: opts.model,
      messages,
      temperature: opts.temperature,
      max_tokens: opts.maxTokens,
      ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
    })
  }

  /** Map a non-2xx Groq response to a coded AIServiceError. */
  private static async toHttpError(res: Response): Promise<AIServiceError> {
    let message = `Groq request failed (${res.status})`
    try {
      const body = await res.json()
      if (body?.error?.message) message = body.error.message
    } catch {
      // non-JSON body; keep default message
    }

    const retryAfter = this.parseRetryAfter(res.headers)

    if (res.status === 429) {
      const isQuota = /quota|insufficient|billing/i.test(message)
      return new AIServiceError(message, isQuota ? 'quota' : 'rate_limit', retryAfter)
    }
    if (res.status >= 500) return new AIServiceError(message, 'unavailable', retryAfter)
    return new AIServiceError(message, 'unknown', retryAfter)
  }

  private static parseRetryAfter(headers: Headers): number | undefined {
    const raw = headers?.get?.('retry-after')
    if (!raw) return undefined
    const seconds = parseInt(raw, 10)
    return Number.isFinite(seconds) ? seconds : undefined
  }

  /** Retry a single Groq attempt on transient errors (5xx / rate limit). */
  private static async withGroqRetry(attempt: () => Promise<string>): Promise<string> {
    for (let i = 0; ; i++) {
      try {
        return await attempt()
      } catch (error) {
        const code = error instanceof AIServiceError ? error.code : 'unknown'
        const retryable = code === 'unavailable' || code === 'rate_limit'
        if (!retryable || i >= this.MAX_RETRIES - 1) throw error

        const retryAfter =
          error instanceof AIServiceError && error.retryAfterSeconds
            ? error.retryAfterSeconds * 1000
            : this.RETRY_DELAYS[i]
        console.log(
          `Groq ${code}, retrying in ${retryAfter}ms (attempt ${i + 1}/${this.MAX_RETRIES})`
        )
        await new Promise((r) => setTimeout(r, retryAfter))
      }
    }
  }

  /** Groq call with retry on transient errors (5xx / rate limit). */
  private static async callGroq(messages: ChatMessage[], opts: GroqOptions): Promise<string> {
    return this.withGroqRetry(() => this.callGroqOnce(messages, opts))
  }

  /**
   * OCR / describe an image via Groq vision (multimodal Llama 4 Scout).
   * `base64Image` must be under Groq's ~4MB base64 limit. No Gemini.
   */
  static async extractImageText(base64Image: string, mimeType: string): Promise<string> {
    const prompt =
      'Extract all text from this image. If it contains diagrams, formulas, or charts, ' +
      'describe them in detail. Respond only with the extracted content.'
    return this.withGroqRetry(() =>
      this.groqPost({
        model: this.VISION_MODEL,
        temperature: 0.2,
        max_tokens: 4000,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Image}` } },
            ],
          },
        ],
      })
    )
  }

  // ---------------------------------------------------------------------------
  // Parsing / validation
  // ---------------------------------------------------------------------------

  /** Extract a JSON object from a model response (handles markdown fences). */
  private static extractJson(text: string): any {
    let jsonText = text.trim()

    if (jsonText.startsWith('```')) {
      const match = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (match) jsonText = match[1].trim()
    }

    const jsonMatch = jsonText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new AIServiceError('No JSON found in AI response', 'parse')

    try {
      return JSON.parse(jsonMatch[0])
    } catch {
      throw new AIServiceError('AI response was not valid JSON', 'parse')
    }
  }

  /** Parse and structurally validate a quiz-generation response. */
  static parseQuizResponse(text: string): GeneratedQuiz {
    const parsed = this.extractJson(text)
    if (!Array.isArray(parsed?.questions) || parsed.questions.length === 0) {
      throw new AIServiceError('AI response contained no questions', 'parse')
    }
    return parsed as GeneratedQuiz
  }

  /**
   * Recover question objects from a response whose JSON is truncated (e.g. the
   * model hit max_tokens mid-array). Scans balanced top-level objects inside the
   * `questions` array, string-aware, and drops any trailing incomplete one.
   */
  static salvageQuestions(text: string): any[] {
    const anchor = text.indexOf('"questions"')
    const arrStart = text.indexOf('[', anchor === -1 ? 0 : anchor)
    if (arrStart === -1) return []

    const objects: any[] = []
    let depth = 0
    let objStart = -1
    let inStr = false
    let escaped = false

    for (let i = arrStart; i < text.length; i++) {
      const ch = text[i]
      if (inStr) {
        if (escaped) escaped = false
        else if (ch === '\\') escaped = true
        else if (ch === '"') inStr = false
        continue
      }
      if (ch === '"') inStr = true
      else if (ch === '{') {
        if (depth === 0) objStart = i
        depth++
      } else if (ch === '}') {
        depth--
        if (depth === 0 && objStart !== -1) {
          try {
            objects.push(JSON.parse(text.slice(objStart, i + 1)))
          } catch {
            // skip malformed object
          }
          objStart = -1
        }
      }
    }
    return objects
  }

  static validateQuizConfig(config: QuizConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    if (config.questionCount < this.MIN_QUESTIONS) {
      errors.push(`Question count must be at least ${this.MIN_QUESTIONS}`)
    }
    if (config.questionCount > this.MAX_QUESTIONS) {
      errors.push(`Question count must be at most ${this.MAX_QUESTIONS}`)
    }
    if (!config.questionTypes || config.questionTypes.length === 0) {
      errors.push('At least one question type is required')
    }

    return { valid: errors.length === 0, errors }
  }

  /** Drop questions that fail quality checks; returns the survivors. */
  private static filterValidQuestions(questions: any[]): any[] {
    return questions.filter((q, idx) => {
      const problems: string[] = []

      if (q.questionType === 'multiple_choice' && Array.isArray(q.options)) {
        const unique = new Set(q.options.map((o: string) => o.toLowerCase().trim()))
        if (unique.size < q.options.length) problems.push('duplicate options')
        if (q.options.length !== 4) problems.push('needs exactly 4 options')
        const matches = q.options.some(
          (opt: string) => opt.trim().toLowerCase() === q.correctAnswer?.trim().toLowerCase()
        )
        if (!matches) problems.push('correctAnswer matches no option')
      }

      if (!q.questionText || q.questionText.trim().length < 10) problems.push('question too short')
      if (!q.correctAnswer) problems.push('missing correct answer')

      if (problems.length > 0) {
        console.warn(`Dropping question ${idx + 1}: ${problems.join(', ')}`)
        return false
      }
      return true
    })
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * One generation round: call the model, parse (with salvage fallback for
   * truncated JSON), and keep only questions that pass quality checks.
   */
  private static async requestQuestions(
    content: string,
    config: QuizConfig,
    materialTitle: string | undefined,
    language: string | undefined,
    count: number
  ): Promise<{ title?: string; questions: any[] }> {
    const prompt = buildQuizGenerationPrompt(content, { ...config, questionCount: count }, materialTitle, language)
    // Scale the output budget to the question count (cap at Groq's limit).
    const maxTokens = Math.min(8000, 1200 + count * 260)

    const raw = await this.complete(prompt, {
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      temperature: 0.7,
      maxTokens,
    })

    let title: string | undefined
    let rawQuestions: any[]
    try {
      const parsed = this.parseQuizResponse(raw)
      title = parsed.title
      rawQuestions = parsed.questions
    } catch (error) {
      // JSON likely truncated at max_tokens — recover complete question objects.
      rawQuestions = this.salvageQuestions(raw)
      if (rawQuestions.length === 0) throw error
      console.log(`Quiz JSON unparseable; salvaged ${rawQuestions.length} questions`)
    }

    return { title, questions: this.filterValidQuestions(rawQuestions) }
  }

  static async generateQuiz(
    content: string,
    config: QuizConfig,
    materialTitle?: string,
    language?: string
  ): Promise<Omit<Quiz, 'id' | 'userId' | 'materialId' | 'createdAt'>> {
    const requested = config.questionCount

    // Collapse to a normalized key so near-duplicates ("What is X?" vs
    // "What is X ?") are treated as the same question.
    const dupKey = (q: any) =>
      (q.questionText || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()

    const seen = new Set<string>()
    const dedupe = (batch: any[]) => {
      for (const q of batch) {
        const key = dupKey(q)
        if (key && !seen.has(key)) {
          seen.add(key)
          questions.push(q)
        }
      }
    }

    const first = await this.requestQuestions(content, config, materialTitle, language, requested)
    let questions: any[] = []
    dedupe(first.questions)

    // Top up once if validation/dedup left us short of what the user asked for.
    if (questions.length < requested) {
      const missing = requested - questions.length
      try {
        const extra = await this.requestQuestions(
          content,
          config,
          materialTitle,
          language,
          missing
        )
        dedupe(extra.questions)
      } catch (error) {
        console.log('Quiz top-up failed, using partial set:', (error as Error)?.message)
      }
    }

    if (questions.length === 0) throw new AIServiceError('No valid questions generated', 'parse')

    // Never hand back more than requested.
    questions = questions.slice(0, requested)

    return {
      title: first.title || `Quiz: ${materialTitle || 'Study Material'}`,
      difficulty: config.difficulty,
      totalQuestions: questions.length,
      status: 'draft' as const,
      score: null,
      questions: questions.map((q: any, i: number): any => ({
        questionText: q.questionText,
        questionType: q.questionType,
        difficulty: q.difficulty || config.difficulty,
        options: q.options || null,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation || '',
        orderIndex: i,
      })),
      completedAt: null,
    }
  }

  static async verifyAnswer(
    question: Question,
    userAnswer: string
  ): Promise<AnswerVerification> {
    const correctAnswer = question.correctAnswer

    // Multiple choice — deterministic, no AI call needed.
    if (question.questionType === 'multiple_choice') {
      const norm = (s?: string) => (s || '').replace(/\s+/g, ' ').trim().toLowerCase()
      const isCorrect = norm(userAnswer) === norm(correctAnswer)
      return {
        isCorrect,
        feedback: isCorrect
          ? question.explanation || 'Correct!'
          : `Incorrect. The correct answer is: ${correctAnswer}. ${question.explanation || ''}`,
        correctAnswer,
      }
    }

    // Reject empty / non-substantive answers deterministically — the model is
    // too lenient and will accept "..." or gibberish as a paraphrase.
    if (userAnswer.replace(/[^\p{L}\p{N}]/gu, '').length === 0) {
      return {
        isCorrect: false,
        feedback: `Incorrect. The expected answer is: ${correctAnswer}`,
        correctAnswer,
      }
    }

    const prompt = buildAnswerVerificationPrompt(
      question.questionText,
      correctAnswer,
      userAnswer,
      question.questionType
    )
    const raw = await this.complete(prompt, {
      model: 'llama-3.1-8b-instant',
      temperature: 0.3,
      maxTokens: 500,
    })

    try {
      const parsed = this.extractJson(raw)
      return {
        isCorrect: !!parsed.isCorrect,
        feedback:
          parsed.feedback ||
          (parsed.isCorrect
            ? 'Correct!'
            : `Incorrect. The expected answer is: ${correctAnswer}`),
        correctAnswer,
      }
    } catch {
      // Model returned unparseable output — fail closed instead of throwing.
      return {
        isCorrect: false,
        feedback: `Could not verify the answer automatically. The expected answer is: ${correctAnswer}`,
        correctAnswer,
      }
    }
  }

  /**
   * Single-prompt JSON completion: Gemini primary (when configured), Groq
   * fallback. Groq is used directly when Gemini is unconfigured.
   */
  private static async complete(prompt: string, groqOpts: GroqOptions): Promise<string> {
    if (process.env.GOOGLE_AI_API_KEY) {
      try {
        return await this.callGemini(prompt)
      } catch (error) {
        console.log('Gemini failed, falling back to Groq:', (error as Error)?.message)
      }
    }
    return this.callGroq([{ role: 'user', content: prompt }], { ...groqOpts, json: true })
  }

  /**
   * Multi-turn free-text chat: Gemini primary (when configured), Groq fallback.
   * Used for material chat and graph concept extraction.
   */
  static async chat(
    messages: ChatMessage[],
    opts: Partial<GroqOptions> = {}
  ): Promise<string> {
    const groqOpts: GroqOptions = {
      model: opts.model ?? 'llama-3.1-8b-instant',
      temperature: opts.temperature ?? 0.5,
      maxTokens: opts.maxTokens ?? 1000,
      json: false,
    }

    if (process.env.GOOGLE_AI_API_KEY) {
      try {
        return await this.withTimeout(
          (async () => {
            const model = this.getGeminiClient().getGenerativeModel({
              model: 'gemini-2.0-flash',
            })
            const history = messages.slice(0, -1).map((m) => ({
              role: m.role === 'assistant' ? 'model' : 'user',
              parts: [{ text: m.content }],
            }))
            const chat = model.startChat({ history })
            const result = await chat.sendMessage(messages[messages.length - 1].content)
            return result.response.text()
          })(),
          this.TIMEOUT
        )
      } catch (error) {
        console.log('Gemini chat failed, falling back to Groq:', (error as Error)?.message)
      }
    }

    return this.callGroq(messages, groqOpts)
  }

  /**
   * Stream a chat completion token-by-token (Groq SSE). Falls back to a single
   * buffered chunk if streaming isn't available (no key / non-stream response).
   */
  static async *streamChat(
    messages: ChatMessage[],
    opts: Partial<GroqOptions> = {}
  ): AsyncGenerator<string> {
    const apiKey = process.env.GROQ_API_KEY
    if (!apiKey) {
      yield await this.chat(messages, opts)
      return
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.TIMEOUT * 2)
    try {
      const res = await this.getFetch()(GROQ_URL, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: opts.model ?? 'llama-3.1-8b-instant',
          messages,
          temperature: opts.temperature ?? 0.5,
          max_tokens: opts.maxTokens ?? 1000,
          stream: true,
        }),
      })

      if (!res.ok || !res.body) {
        yield await this.chat(messages, opts)
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data:')) continue
          const data = trimmed.slice(5).trim()
          if (data === '[DONE]') return
          try {
            const delta = JSON.parse(data)?.choices?.[0]?.delta?.content
            if (delta) yield delta
          } catch {
            // keep-alive / partial frame — ignore
          }
        }
      }
    } finally {
      clearTimeout(timer)
    }
  }
}
