import 'server-only'

import { getSupabaseAdmin } from '@/lib/supabase/server'
import { AIService } from './AIService'
import type { Quiz, QuizConfig, Question, Answer, QuizResults } from '@/lib/types'

export class QuizService {
  static async createQuiz(
    userId: string,
    materialId: string,
    config: QuizConfig
  ): Promise<Quiz> {
    const db = getSupabaseAdmin()
    
    const { data: material } = await db
      .from('study_materials')
      .select('parsed_content, title')
      .eq('id', materialId)
      .single()

    if (!material?.parsed_content) {
      throw new Error('Material not parsed yet')
    }

    const quizData = await AIService.generateQuiz(material.parsed_content, config)
    const quizId = crypto.randomUUID()

    const { error } = await db.from('quizzes').insert({
      id: quizId,
      user_id: userId,
      material_id: materialId,
      title: quizData.title,
      difficulty: quizData.difficulty,
      total_questions: quizData.totalQuestions,
      status: 'draft',
    })

    if (error) throw new Error(error.message)

    const questions = quizData.questions.map((q) => ({
      ...q,
      id: crypto.randomUUID(),
      quiz_id: quizId,
    }))

    await db.from('questions').insert(questions)

    return this.getQuiz(quizId)
  }

  static async getQuiz(quizId: string): Promise<Quiz> {
    const db = getSupabaseAdmin()
    
    const { data: quiz, error } = await db
      .from('quizzes')
      .select('*')
      .eq('id', quizId)
      .single()

    if (error || !quiz) throw new Error('Quiz not found')

    const { data: questions } = await db
      .from('questions')
      .select('*')
      .eq('quiz_id', quizId)
      .order('order_index')

    return {
      id: quiz.id,
      userId: quiz.user_id,
      materialId: quiz.material_id,
      title: quiz.title,
      difficulty: quiz.difficulty,
      totalQuestions: quiz.total_questions,
      status: quiz.status,
      score: quiz.score,
      questions: questions || [],
      completedAt: quiz.completed_at,
      createdAt: quiz.created_at,
    }
  }

  static async submitAnswer(
    userId: string,
    quizId: string,
    questionId: string,
    userAnswer: string
  ): Promise<Answer> {
    const db = getSupabaseAdmin()
    
    const { data: question } = await db
      .from('questions')
      .select('*')
      .eq('id', questionId)
      .single()

    if (!question) throw new Error('Question not found')

    const verification = await AIService.verifyAnswer(question, userAnswer)

    const answer = {
      id: crypto.randomUUID(),
      quiz_id: quizId,
      question_id: questionId,
      user_answer: userAnswer,
      is_correct: verification.isCorrect,
      feedback: verification.feedback,
    }

    await db.from('answers').insert(answer)

    return {
      ...answer,
      isCorrect: answer.is_correct,
      answeredAt: new Date().toISOString(),
    }
  }

  static async completeQuiz(quizId: string): Promise<QuizResults> {
    const db = getSupabaseAdmin()
    
    const { data: answers } = await db
      .from('answers')
      .select('*')
      .eq('quiz_id', quizId)

    const { data: quiz } = await db
      .from('quizzes')
      .select('total_questions')
      .eq('id', quizId)
      .single()

    if (!quiz || !answers) throw new Error('Quiz not found')

    const correctCount = answers.filter((a) => a.is_correct).length
    const score = (correctCount / quiz.total_questions) * 100

    await db
      .from('quizzes')
      .update({ status: 'completed', score, completed_at: new Date().toISOString() })
      .eq('id', quizId)

    return {
      quizId,
      score,
      correctCount,
      totalQuestions: quiz.total_questions,
      answers: answers.map((a) => ({
        ...a,
        isCorrect: a.is_correct,
        answeredAt: a.answered_at,
      })),
      completedAt: new Date().toISOString(),
    }
  }
}
