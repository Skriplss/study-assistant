import Groq from 'groq-sdk'
import type { Quiz, Question, QuizConfig, AnswerVerification } from '@/lib/types'
import { buildQuizGenerationPrompt, buildAnswerVerificationPrompt } from '@/lib/ai/quiz-prompt'

export class AIService {
  static groq: Groq | null = null
  static readonly MAX_RETRIES = 3
  static readonly TIMEOUT = 45000 // Increased for quiz generation
  static readonly RETRY_DELAYS = [1000, 2000, 4000]

  static getClient(): Groq {
    if (!this.groq) {
      const apiKey = process.env.GROQ_API_KEY
      if (!apiKey) throw new Error('GROQ_API_KEY not configured')
      this.groq = new Groq({ apiKey })
    }
    return this.groq
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
      const err = error as { status?: number }
      if (err?.status === 429) {
        await new Promise((r) => setTimeout(r, this.RETRY_DELAYS[attempt]))
        return this.callWithRetry(fn, attempt + 1)
      }
      throw error
    }
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
    materialTitle?: string
  ): Promise<Omit<Quiz, 'id' | 'userId' | 'materialId' | 'createdAt'>> {
    const prompt = buildQuizGenerationPrompt(content, config, materialTitle)

    return this.callWithRetry(async () => {
      const client = this.getClient()
      const response = await client.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 8000,
      })

      const text = response.choices[0]?.message?.content
      if (!text) throw new Error('No response from AI')

      // Extract JSON from response
      let jsonText = text.trim()
      if (jsonText.startsWith('```')) {
        const match = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/)
        jsonText = match ? match[1].trim() : jsonText
      }

      const jsonMatch = jsonText.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('No valid JSON found in response')

      const parsed = JSON.parse(jsonMatch[0])

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
    })
  }

  static async verifyAnswer(
    question: Question,
    userAnswer: string
  ): Promise<AnswerVerification> {
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

    const correctAnswer = (question as any).correct_answer ?? question.correctAnswer
    const prompt = buildAnswerVerificationPrompt(
      (question as any).question_text ?? question.questionText,
      correctAnswer,
      userAnswer,
      question.questionType
    )

    return this.callWithRetry(async () => {
      const client = this.getClient()
      const response = await client.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 500,
      })

      const text = response.choices[0]?.message?.content
      if (!text) throw new Error('No response from AI')

      let jsonText = text.trim()
      if (jsonText.startsWith('```')) {
        const match = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/)
        jsonText = match ? match[1].trim() : jsonText
      }

      const jsonMatch = jsonText.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('No JSON found')

      const parsed = JSON.parse(jsonMatch[0])

      return {
        isCorrect: parsed.isCorrect,
        feedback: parsed.feedback,
        correctAnswer,
      }
    })
  }
}
