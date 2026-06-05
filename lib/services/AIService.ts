import {
  buildAnswerVerificationPrompt,
  buildQuizGenerationPrompt,
} from '@/lib/ai/quiz-prompt'
import { AIServiceError } from '@/lib/ai/errors'
import type {
  AnswerVerification,
  GeneratedQuiz,
  GroqOptions,
  Question,
  QuizConfig,
} from '@/lib/types'

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'
const DEFAULT_MODEL = 'llama-3.3-70b-versatile'
const DEFAULT_TIMEOUT_MS = 30_000
const MAX_RETRIES = 3
const RETRY_BASE_MS = 1_000

type FetchFn = typeof fetch

interface GroqChatResponse {
  choices?: Array<{
    message?: { content?: string }
  }>
  error?: { message?: string }
}

export class AIService {
  private static fetchFn: FetchFn | undefined

  static setFetchImplementation(fn: FetchFn): void {
    this.fetchFn = fn
  }

  static resetFetchImplementation(): void {
    this.fetchFn = undefined
  }

  private static resolveFetch(): FetchFn {
    if (this.fetchFn) {
      return this.fetchFn
    }
    if (typeof globalThis.fetch !== 'function') {
      throw new AIServiceError('Fetch is not available', 'unavailable')
    }
    return globalThis.fetch.bind(globalThis)
  }

  static validateQuizConfig(config: QuizConfig): {
    valid: boolean
    error?: string
  } {
    if (config.questionCount < 5 || config.questionCount > 50) {
      return {
        valid: false,
        error: 'Question count must be between 5 and 50',
      }
    }
    if (config.questionTypes.length === 0) {
      return {
        valid: false,
        error: 'At least one question type is required',
      }
    }
    return { valid: true }
  }

  static async generateQuiz(
    content: string,
    config: QuizConfig,
    materialTitle?: string
  ): Promise<GeneratedQuiz> {
    const validation = this.validateQuizConfig(config)
    if (!validation.valid) {
      throw new AIServiceError(validation.error!, 'unknown')
    }

    if (!content.trim()) {
      throw new AIServiceError(
        'Material has no parsed content to generate a quiz from',
        'unknown'
      )
    }

    const prompt = buildQuizGenerationPrompt(content, config, materialTitle)
    const raw = await this.callGroqAPI<string>(prompt, {
      model: DEFAULT_MODEL,
      temperature: 0.4,
      maxTokens: 8192,
      timeout: DEFAULT_TIMEOUT_MS,
    })

    return this.parseQuizResponse(raw)
  }

  static async verifyAnswer(
    question: Pick<
      Question,
      'questionText' | 'questionType' | 'correctAnswer'
    >,
    userAnswer: string
  ): Promise<AnswerVerification> {
    if (question.questionType === 'multiple_choice') {
      const isCorrect =
        userAnswer.trim().toLowerCase() ===
        question.correctAnswer.trim().toLowerCase()
      if (isCorrect) {
        return {
          isCorrect: true,
          feedback: 'Correct! Well done.',
          correctAnswer: question.correctAnswer,
        }
      }
    }

    const prompt = buildAnswerVerificationPrompt(
      question.questionText,
      question.correctAnswer,
      userAnswer,
      question.questionType
    )

    const raw = await this.callGroqAPI<string>(prompt, {
      model: DEFAULT_MODEL,
      temperature: 0.2,
      maxTokens: 1024,
      timeout: DEFAULT_TIMEOUT_MS,
    })

    return this.parseVerificationResponse(raw, question.correctAnswer)
  }

  private static async callGroqAPI<T>(
    prompt: string,
    options: GroqOptions
  ): Promise<T> {
    const apiKey = process.env.GROQ_API_KEY
    if (!apiKey) {
      throw new AIServiceError(
        'GROQ_API_KEY is not configured',
        'config'
      )
    }

    let lastError: AIServiceError | null = null

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const content = await this.requestGroq(prompt, options, apiKey)
        return content as T
      } catch (error) {
        if (!(error instanceof AIServiceError)) {
          throw error
        }
        lastError = error

        const retryable =
          error.code === 'rate_limit' ||
          error.code === 'unavailable' ||
          error.code === 'timeout'

        if (!retryable || attempt === MAX_RETRIES - 1) {
          throw error
        }

        const delay =
          (error.retryAfterSeconds ?? 0) * 1000 ||
          RETRY_BASE_MS * 2 ** attempt
        await this.sleep(delay)
      }
    }

    throw lastError ?? new AIServiceError('AI request failed', 'unknown')
  }

  private static async requestGroq(
    prompt: string,
    options: GroqOptions,
    apiKey: string
  ): Promise<string> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), options.timeout)

    try {
      const response = await this.resolveFetch()(GROQ_API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: options.model,
          temperature: options.temperature,
          max_tokens: options.maxTokens,
          messages: [
            {
              role: 'system',
              content:
                'You are a precise assistant that returns only valid JSON when asked.',
            },
            { role: 'user', content: prompt },
          ],
        }),
        signal: controller.signal,
      })

      if (response.status === 429) {
        const retryAfter = parseInt(
          response.headers.get('retry-after') ?? '0',
          10
        )
        const body = (await response.json().catch(() => ({}))) as GroqChatResponse
        const message = body.error?.message ?? 'Rate limit exceeded'
        const code = message.toLowerCase().includes('quota')
          ? 'quota'
          : 'rate_limit'
        throw new AIServiceError(message, code, retryAfter || 60)
      }

      if (response.status === 402 || response.status === 403) {
        throw new AIServiceError(
          'AI quota or permissions issue',
          'quota'
        )
      }

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as GroqChatResponse
        throw new AIServiceError(
          body.error?.message ?? `AI request failed (${response.status})`,
          response.status >= 500 ? 'unavailable' : 'unknown'
        )
      }

      const body = (await response.json()) as GroqChatResponse
      const content = body.choices?.[0]?.message?.content

      if (!content) {
        throw new AIServiceError('Empty AI response', 'parse')
      }

      return content
    } catch (error) {
      if (error instanceof AIServiceError) {
        throw error
      }
      if (error instanceof Error && error.name === 'AbortError') {
        throw new AIServiceError('AI request timed out', 'timeout')
      }
      throw new AIServiceError(
        error instanceof Error ? error.message : 'AI request failed',
        'unavailable'
      )
    } finally {
      clearTimeout(timeoutId)
    }
  }

  static parseQuizResponse(raw: string): GeneratedQuiz {
    const parsed = this.extractJson(raw) as GeneratedQuiz

    if (!parsed?.title || !Array.isArray(parsed.questions)) {
      throw new AIServiceError('Invalid quiz structure in AI response', 'parse')
    }

    if (parsed.questions.length === 0) {
      throw new AIServiceError('AI returned no questions', 'parse')
    }

    for (const q of parsed.questions) {
      if (!q.questionText || !q.correctAnswer || !q.questionType) {
        throw new AIServiceError('Invalid question in AI response', 'parse')
      }
      if (
        q.questionType === 'multiple_choice' &&
        (!q.options || q.options.length < 2)
      ) {
        throw new AIServiceError(
          'Multiple choice question missing options',
          'parse'
        )
      }
    }

    return parsed
  }

  static parseVerificationResponse(
    raw: string,
    fallbackCorrectAnswer: string
  ): AnswerVerification {
    const parsed = this.extractJson(raw) as AnswerVerification

    if (typeof parsed?.isCorrect !== 'boolean' || !parsed.feedback) {
      throw new AIServiceError(
        'Invalid verification structure in AI response',
        'parse'
      )
    }

    return {
      isCorrect: parsed.isCorrect,
      feedback: parsed.feedback,
      correctAnswer: parsed.correctAnswer ?? fallbackCorrectAnswer,
    }
  }

  static extractJson(raw: string): unknown {
    const trimmed = raw.trim()
    const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
    const candidate = fenceMatch ? fenceMatch[1].trim() : trimmed

    const start = candidate.indexOf('{')
    const end = candidate.lastIndexOf('}')
    if (start === -1 || end === -1) {
      throw new AIServiceError('No JSON object in AI response', 'parse')
    }

    try {
      return JSON.parse(candidate.slice(start, end + 1))
    } catch {
      throw new AIServiceError('Failed to parse AI JSON response', 'parse')
    }
  }

  private static sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}
