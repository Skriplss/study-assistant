import Groq from 'groq-sdk'
import { GoogleGenerativeAI } from '@google/generative-ai'
import type { Quiz, Question, QuizConfig, AnswerVerification } from '@/lib/types'
import { buildQuizGenerationPrompt, buildAnswerVerificationPrompt } from '@/lib/ai/quiz-prompt'

export class AIService {
  static groq: Groq | null = null
  static gemini: GoogleGenerativeAI | null = null
  static readonly MAX_RETRIES = 3
  static readonly TIMEOUT = 45000 // Increased for quiz generation
  static readonly RETRY_DELAYS = [1000, 2000, 4000]

  static getGroqClient(): Groq {
    if (!this.groq) {
      const apiKey = process.env.GROQ_API_KEY
      if (!apiKey) throw new Error('GROQ_API_KEY not configured')
      this.groq = new Groq({ apiKey })
    }
    return this.groq
  }

  static getGeminiClient(): GoogleGenerativeAI {
    if (!this.gemini) {
      const apiKey = process.env.GOOGLE_AI_API_KEY
      if (!apiKey) throw new Error('GOOGLE_AI_API_KEY not configured')
      this.gemini = new GoogleGenerativeAI(apiKey)
    }
    return this.gemini
  }

  static async callWithRetry<T>(fn: () => Promise<T>, attempt = 0): Promise<T> {
    try {
      return await Promise.race([
        fn(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), this.TIMEOUT)
        ),
      ])
    } catch (error: unknown) {
      if (attempt >= this.MAX_RETRIES - 1) throw error
      
      const err = error as { status?: number; message?: string }
      
      // Check for rate limit errors (both Groq and Gemini)
      const isRateLimit = err?.status === 429 || 
                          err?.message?.includes('429') ||
                          err?.message?.includes('rate limit') ||
                          err?.message?.includes('quota')
      
      if (isRateLimit) {
        const delay = this.RETRY_DELAYS[attempt]
        console.log(`Rate limit hit, retrying in ${delay}ms (attempt ${attempt + 1}/${this.MAX_RETRIES})`)
        await new Promise((r) => setTimeout(r, delay))
        return this.callWithRetry(fn, attempt + 1)
      }
      
      throw error
    }
  }

  /**
   * Extract JSON from text response (handles markdown code blocks)
   */
  private static parseJsonFromText(text: string): any {
    let jsonText = text.trim()
    
    // Remove markdown code blocks if present
    if (jsonText.startsWith('```')) {
      const match = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/)
      jsonText = match ? match[1].trim() : jsonText
    }

    // Extract JSON object
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No valid JSON found in response')

    return JSON.parse(jsonMatch[0])
  }

  /**
   * Validate quiz questions for quality
   */
  private static validateQuestions(questions: any[]): string[] {
    const errors: string[] = []

    questions.forEach((q, idx) => {
      // Check for duplicate options in multiple choice
      if (q.questionType === 'multiple_choice' && Array.isArray(q.options)) {
        const uniqueOptions = new Set(q.options.map((o: string) => o.toLowerCase().trim()))
        if (uniqueOptions.size < q.options.length) {
          errors.push(`Question ${idx + 1}: Has duplicate options`)
        }
        if (q.options.length !== 4) {
          errors.push(`Question ${idx + 1}: Must have exactly 4 options`)
        }
        // Check if correctAnswer matches one of the options
        const hasMatchingOption = q.options.some(
          (opt: string) => opt.trim().toLowerCase() === q.correctAnswer?.trim().toLowerCase()
        )
        if (!hasMatchingOption) {
          errors.push(`Question ${idx + 1}: correctAnswer doesn't match any option`)
        }
      }

      // Basic validation
      if (!q.questionText || q.questionText.trim().length < 10) {
        errors.push(`Question ${idx + 1}: Question text too short`)
      }
      if (!q.correctAnswer) {
        errors.push(`Question ${idx + 1}: Missing correct answer`)
      }
    })

    return errors
  }

  static async generateQuiz(
    content: string,
    config: QuizConfig,
    materialTitle?: string,
    language?: string
  ): Promise<Omit<Quiz, 'id' | 'userId' | 'materialId' | 'createdAt'>> {
    const prompt = buildQuizGenerationPrompt(content, config, materialTitle, language)

    // Try Gemini first, fallback to Groq on rate limits or errors
    let text: string | null | undefined
    let usedGroq = false
    
    try {
      console.log('Using Gemini for quiz generation')
      text = await this.callWithRetry(async () => {
        const gemini = this.getGeminiClient()
        const model = gemini.getGenerativeModel({ model: 'gemini-2.0-flash' })
        const result = await model.generateContent(prompt)
        const response = result.response
        return response.text()
      })
    } catch (geminiError: any) {
      // Check if it's a rate limit or quota error
      const isRateLimit = geminiError?.message?.includes('429') || 
                          geminiError?.message?.includes('quota') ||
                          geminiError?.message?.includes('rate limit')
      
      if (isRateLimit) {
        console.log('Gemini quota/rate limit reached, falling back to Groq')
      } else {
        console.log('Gemini error, falling back to Groq:', geminiError?.message)
      }
      
      // Try Groq with a more capable model that has higher limits
      usedGroq = true
      text = await this.callWithRetry(async () => {
        const client = this.getGroqClient()
        const response = await client.chat.completions.create({
          model: 'meta-llama/llama-4-scout-17b-16e-instruct', // 30K TPM limit
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens: 8000,
        })
        return response.choices[0]?.message?.content
      })
    }

    if (!text) throw new Error('No response from AI')

    const parsed = this.parseJsonFromText(text)

    // Validate questions
    const validationErrors = this.validateQuestions(parsed.questions || [])
    if (validationErrors.length > 0) {
      console.warn('Quiz validation warnings:', validationErrors)
      // Filter out invalid questions
      parsed.questions = (parsed.questions || []).filter((_q: any, idx: number) => {
        return !validationErrors.some(err => err.startsWith(`Question ${idx + 1}:`))
      })
    }

    if (!parsed.questions || parsed.questions.length === 0) {
      throw new Error('No valid questions generated')
    }

    if (usedGroq) {
      console.log('Successfully generated quiz using Groq fallback')
    }

    return {
      title: parsed.title || `Quiz: ${materialTitle || 'Study Material'}`,
      difficulty: config.difficulty,
      totalQuestions: parsed.questions.length,
      status: 'draft' as const,
      score: null,
      questions: parsed.questions.map((q: any, i: number) => ({
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
    // Multiple choice questions - no AI call needed
    if (question.questionType === 'multiple_choice') {
      const correctAnswer = (question as any).correct_answer ?? question.correctAnswer
      const isCorrect = userAnswer.trim().toLowerCase() === correctAnswer?.trim().toLowerCase()
      
      return {
        isCorrect,
        feedback: isCorrect 
          ? (question.explanation || 'Correct!')
          : `Incorrect. The correct answer is: ${correctAnswer}. ${question.explanation || ''}`,
        correctAnswer,
      }
    }

    // Open-ended questions - use Gemini primary, Groq fallback
    const correctAnswer = (question as any).correct_answer ?? question.correctAnswer
    const prompt = buildAnswerVerificationPrompt(
      (question as any).question_text ?? question.questionText,
      correctAnswer,
      userAnswer,
      question.questionType
    )

    let text: string | null | undefined
    try {
      console.log('Using Gemini')
      text = await this.callWithRetry(async () => {
        const gemini = this.getGeminiClient()
        const model = gemini.getGenerativeModel({ model: 'gemini-2.0-flash' })
        const result = await model.generateContent(prompt)
        const response = result.response
        return response.text()
      })
    } catch (error) {
      console.log('Falling back to Groq')
      text = await this.callWithRetry(async () => {
        const client = this.getGroqClient()
        const response = await client.chat.completions.create({
          model: 'meta-llama/llama-4-scout-17b-16e-instruct',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
          max_tokens: 700,
        })
        return response.choices[0]?.message?.content
      })
    }

    if (!text) throw new Error('No response from AI')

    const parsed = this.parseJsonFromText(text)

    return {
      isCorrect: parsed.isCorrect,
      feedback: parsed.feedback,
      correctAnswer,
    }
  }
}
