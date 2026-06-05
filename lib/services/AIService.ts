import Groq from 'groq-sdk'
import type { Quiz, Question, QuizConfig, AnswerVerification } from '@/lib/types'

export class AIService {
  private static groq: Groq | null = null
  private static readonly MAX_RETRIES = 3
  private static readonly TIMEOUT = 30000
  private static readonly RETRY_DELAYS = [1000, 2000, 4000]

  private static getClient(): Groq {
    if (!this.groq) {
      const apiKey = process.env.GROQ_API_KEY
      if (!apiKey) {
        throw new Error('GROQ_API_KEY not configured')
      }
      this.groq = new Groq({ apiKey })
    }
    return this.groq
  }

  private static async callWithRetry<T>(
    fn: () => Promise<T>,
    attempt = 0
  ): Promise<T> {
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
${content.substring(0, 4000)}

Return ONLY a JSON object with this structure (no markdown, no extra text):
{
  "title": "Quiz title",
  "questions": [
    {
      "questionText": "Question text",
      "questionType": "multiple_choice" or "open_ended",
      "difficulty": "easy" or "medium" or "hard",
      "options": ["option1", "option2", "option3", "option4"] (only for multiple_choice),
      "correctAnswer": "correct answer text",
      "explanation": "why this is correct"
    }
  ]
}`

    return this.callWithRetry(async () => {
      const client = this.getClient()
      const response = await client.chat.completions.create({
        model: 'mixtral-8x7b-32768',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 4000,
      })

      const text = response.choices[0]?.message?.content
      if (!text) throw new Error('No response from AI')

      const parsed = JSON.parse(text.replace(/```json\n?|\n?```/g, ''))
      
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
      return {
        isCorrect: userAnswer.trim() === question.correctAnswer.trim(),
        feedback: question.explanation || 'Check the explanation',
        correctAnswer: question.correctAnswer,
      }
    }

    const prompt = `Compare the user's answer to the correct answer using semantic similarity.

Question: ${question.questionText}
Correct answer: ${question.correctAnswer}
User answer: ${userAnswer}

Return ONLY a JSON object (no markdown):
{
  "isCorrect": true or false,
  "feedback": "detailed explanation",
  "similarity": 0.0 to 1.0
}`

    return this.callWithRetry(async () => {
      const client = this.getClient()
      const response = await client.chat.completions.create({
        model: 'mixtral-8x7b-32768',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 500,
      })

      const text = response.choices[0]?.message?.content
      if (!text) throw new Error('No response from AI')

      const parsed = JSON.parse(text.replace(/```json\n?|\n?```/g, ''))
      
      return {
        isCorrect: parsed.isCorrect,
        feedback: parsed.feedback,
        correctAnswer: question.correctAnswer,
      }
    })
  }
}
