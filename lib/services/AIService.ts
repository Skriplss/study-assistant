import Groq from 'groq-sdk'
import type { Quiz, Question, QuizConfig, AnswerVerification } from '@/lib/types'

export class AIService {
  static groq: Groq | null = null
  static readonly MAX_RETRIES = 3
  static readonly TIMEOUT = 30000
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
    } catch (error: any) {
      if (attempt >= this.MAX_RETRIES - 1) throw error
      if (error?.status === 429) {
        await new Promise((r) => setTimeout(r, this.RETRY_DELAYS[attempt]))
        return this.callWithRetry(fn, attempt + 1)
      }
      throw error
    }
  }

  static async generateQuiz(
    content: string,
    config: QuizConfig
  ): Promise<Omit<Quiz, 'id' | 'userId' | 'materialId' | 'createdAt'>> {
    const prompt = `Generate ${config.questionCount} quiz questions from this content.

Difficulty: ${config.difficulty}
Question types: ${config.questionTypes.join(', ')}

Content:
${content.substring(0, 2000)}

Return ONLY a valid JSON object (no markdown, no extra text):
{
  "title": "Quiz title",
  "questions": [
    {
      "questionText": "Question text",
      "questionType": "multiple_choice",
      "difficulty": "easy",
      "options": ["A", "B", "C", "D"],
      "correctAnswer": "A",
      "explanation": "reason"
    }
  ]
}`

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

      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('No JSON found in response')

      const parsed = JSON.parse(jsonMatch[0])

      return {
        title: parsed.title,
        difficulty: config.difficulty,
        totalQuestions: parsed.questions.length,
        status: 'draft' as const,
        score: null,
        questions: parsed.questions.map((q: any, i: number) => ({
          questionText: q.questionText,
          questionType: q.questionType,
          difficulty: q.difficulty,
          options: q.options || null,
          correctAnswer: q.correctAnswer,
          explanation: q.explanation,
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
      return {
        isCorrect: userAnswer.trim() === correctAnswer?.trim(),
        feedback: (question as any).explanation ?? question.explanation ?? 'Check the explanation',
        correctAnswer,
      }
    }

    const correctAnswer = (question as any).correct_answer ?? question.correctAnswer
    const prompt = `Compare the user's answer to the correct answer.

Question: ${(question as any).question_text ?? question.questionText}
Correct answer: ${correctAnswer}
User answer: ${userAnswer}

Return ONLY a JSON object:
{
  "isCorrect": true or false,
  "feedback": "explanation"
}`

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

      const jsonMatch = text.match(/\{[\s\S]*\}/)
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
