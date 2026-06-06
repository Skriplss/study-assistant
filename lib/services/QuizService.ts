import 'server-only'

import { getSupabaseAdmin } from '@/lib/supabase/server'
import { AIService } from './AIService'
import { AnalyticsService } from './AnalyticsService'
import type { Quiz, QuizConfig, Answer, QuizResults } from '@/lib/types'

export class QuizService {
  static async createQuiz(
    userId: string,
    materialId: string,
    config: QuizConfig
  ): Promise<Quiz> {
    const db = getSupabaseAdmin()
    
    const { data: material } = await db
      .from('study_materials')
      .select('parsed_content, title, language')
      .eq('id', materialId)
      .single()

    if (!material?.parsed_content) {
      throw new Error('Material not parsed yet')
    }

    const quizData = await AIService.generateQuiz(
      material.parsed_content, 
      config, 
      material.title,
      material.language || undefined
    )
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
      id: crypto.randomUUID(),
      quiz_id: quizId,
      question_text: q.questionText,
      question_type: q.questionType,
      difficulty: q.difficulty,
      options: q.options || null,
      correct_answer: q.correctAnswer || 'N/A',
      explanation: q.explanation || null,
      order_index: q.orderIndex,
    }))

    const { error: qError } = await db.from('questions').insert(questions)
    if (qError) throw new Error(`Failed to insert questions: ${qError.message}`)

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
      difficulty: (quiz.difficulty || 'mixed') as 'easy' | 'medium' | 'hard' | 'mixed',
      totalQuestions: quiz.total_questions,
      status: quiz.status as 'draft' | 'in_progress' | 'completed',
      score: quiz.score,
      questions: (questions || []).map(q => ({
        id: q.id,
        quizId: q.quiz_id,
        questionText: q.question_text,
        questionType: q.question_type as 'multiple_choice' | 'open_ended',
        difficulty: (q.difficulty || 'medium') as 'easy' | 'medium' | 'hard',
        options: Array.isArray(q.options) ? q.options as string[] : null,
        correctAnswer: q.correct_answer,
        explanation: q.explanation,
        orderIndex: q.order_index,
      })),
      completedAt: quiz.completed_at,
      createdAt: quiz.created_at || new Date().toISOString(),
    }
  }

  static async submitAnswer(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

    const questionFormatted = {
      id: question.id,
      quizId: question.quiz_id,
      questionText: question.question_text,
      questionType: question.question_type as 'multiple_choice' | 'open_ended',
      difficulty: (question.difficulty || 'medium') as 'easy' | 'medium' | 'hard',
      options: Array.isArray(question.options) ? question.options as string[] : null,
      correctAnswer: question.correct_answer,
      explanation: question.explanation,
      orderIndex: question.order_index,
    }

    const verification = await AIService.verifyAnswer(questionFormatted, userAnswer)

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
      id: answer.id,
      quizId: answer.quiz_id,
      questionId: answer.question_id,
      userAnswer: answer.user_answer,
      isCorrect: answer.is_correct,
      feedback: answer.feedback,
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
      .select('total_questions, user_id, material_id')
      .eq('id', quizId)
      .single()

    if (!quiz || !answers) throw new Error('Quiz not found')

    const correctCount = answers.filter((a) => a.is_correct).length
    const score = (correctCount / quiz.total_questions) * 100

    await db
      .from('quizzes')
      .update({ status: 'completed', score, completed_at: new Date().toISOString() })
      .eq('id', quizId)

    await AnalyticsService.recordQuizCompletion(
      quiz.user_id,
      quizId,
      score,
      quiz.material_id,
      quiz.total_questions,
      correctCount
    )

    return {
      quizId,
      score,
      correctCount,
      totalQuestions: quiz.total_questions,
      answers: answers.map((a) => ({
        id: a.id,
        quizId: a.quiz_id,
        questionId: a.question_id,
        userAnswer: a.user_answer,
        isCorrect: a.is_correct,
        feedback: a.feedback,
        answeredAt: a.answered_at || new Date().toISOString(),
      })),
      completedAt: new Date().toISOString(),
    }
  }
}
