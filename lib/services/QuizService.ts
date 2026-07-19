import 'server-only'

import { getSupabaseAdmin } from '@/lib/supabase/server'
import { ApiError } from '@/lib/api/errors'
import { AIService } from './AIService'
import { AnalyticsService } from './AnalyticsService'
import { ReviewService } from './ReviewService'
import type { Quiz, QuizConfig, Answer, QuizResults, QuizSummary } from '@/lib/types'

export class QuizService {
  /** Quiz history, newest first. Skips questions/answers — the list needs neither. */
  static async listQuizzes(userId: string): Promise<QuizSummary[]> {
    const db = getSupabaseAdmin()

    const { data, error } = await db
      .from('quizzes')
      .select(
        'id, material_id, title, difficulty, total_questions, status, score, completed_at, created_at, study_materials(title)'
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw new Error(error.message)

    return (data || []).map((quiz) => {
      // PostgREST types the embed as object-or-array depending on how it infers
      // the relationship; material_id is a plain FK, so it's always one row.
      const material = quiz.study_materials as { title: string } | { title: string }[] | null
      const materialTitle = Array.isArray(material) ? material[0]?.title : material?.title

      return {
        id: quiz.id,
        materialId: quiz.material_id,
        materialTitle: materialTitle ?? null,
        title: quiz.title,
        difficulty: (quiz.difficulty || 'mixed') as QuizSummary['difficulty'],
        totalQuestions: quiz.total_questions,
        status: quiz.status as QuizSummary['status'],
        score: quiz.score,
        completedAt: quiz.completed_at,
        createdAt: quiz.created_at || new Date().toISOString(),
      }
    })
  }

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
      throw new ApiError('This material is still being processed. Try again once it finishes.', 409)
    }

    const quizData = await AIService.generateQuiz(
      material.parsed_content,
      config,
      material.title,
      config.language || material.language || undefined
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

    if (error || !quiz) throw new ApiError('Quiz not found', 404)

    // Questions and any existing answers are independent reads — run together.
    const [{ data: questions }, { data: answers }] = await Promise.all([
      db.from('questions').select('*').eq('quiz_id', quizId).order('order_index'),
      db.from('answers').select('*').eq('quiz_id', quizId),
    ])

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
      answers: (answers || []).map(a => ({
        id: a.id,
        quizId: a.quiz_id,
        questionId: a.question_id,
        userAnswer: a.user_answer,
        isCorrect: a.is_correct,
        feedback: a.feedback,
        answeredAt: a.answered_at || new Date().toISOString(),
      })),
      completedAt: quiz.completed_at,
      createdAt: quiz.created_at || new Date().toISOString(),
    }
  }

  static async submitAnswer(
    userId: string,
    quizId: string,
    questionId: string,
    userAnswer: string
  ): Promise<Answer> {
    const db = getSupabaseAdmin()

    const [{ data: quiz }, { data: question }] = await Promise.all([
      db.from('quizzes').select('user_id, status').eq('id', quizId).single(),
      db.from('questions').select('*').eq('id', questionId).single(),
    ])

    if (!quiz || quiz.user_id !== userId) throw new ApiError('Quiz not found', 404)
    if (!question || question.quiz_id !== quizId) throw new ApiError('Question not found', 404)

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

    const { error: saveError } = await db
      .from('answers')
      .upsert(answer, { onConflict: 'quiz_id,question_id' })
    if (saveError) throw new Error(`Failed to save answer: ${saveError.message}`)

    // First answer moves the quiz out of the draft state.
    if (quiz.status === 'draft') {
      await db.from('quizzes').update({ status: 'in_progress' }).eq('id', quizId)
    }

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

  static async completeQuiz(userId: string, quizId: string): Promise<QuizResults> {
    const db = getSupabaseAdmin()

    // Independent reads — run concurrently.
    const [{ data: answers }, { data: quiz }] = await Promise.all([
      db.from('answers').select('*').eq('quiz_id', quizId),
      db
        .from('quizzes')
        .select('total_questions, user_id, material_id, status, score, completed_at')
        .eq('id', quizId)
        .single(),
    ])

    if (!quiz || !answers) throw new Error('Quiz not found')
    if (quiz.user_id !== userId) throw new Error('Quiz not found')

    const formatAnswers = () =>
      answers.map((a) => ({
        id: a.id,
        quizId: a.quiz_id,
        questionId: a.question_id,
        userAnswer: a.user_answer,
        isCorrect: a.is_correct,
        feedback: a.feedback,
        answeredAt: a.answered_at || new Date().toISOString(),
      }))

    // Already scored — hand back what was recorded rather than recording it
    // again. Without this a second call writes a second progress_snapshot and
    // takes another SM-2 step on every question; the live DB has quizzes with
    // four identical snapshots seconds apart from exactly that. retakeQuiz
    // reopens the quiz to 'in_progress', so genuine retakes still fall through.
    if (quiz.status === 'completed') {
      return {
        quizId,
        score: quiz.score ?? 0,
        correctCount: answers.filter((a) => a.is_correct).length,
        totalQuestions: quiz.total_questions,
        answers: formatAnswers(),
        completedAt: quiz.completed_at ?? new Date().toISOString(),
      }
    }

    // Every question must be answered before the quiz can be scored.
    const answeredCount = new Set(answers.map((a) => a.question_id)).size
    if (answeredCount < quiz.total_questions) {
      throw new Error('All questions must be answered before finishing the quiz')
    }

    const correctCount = answers.filter((a) => a.is_correct).length
    const score = (correctCount / quiz.total_questions) * 100

    // Status update, analytics insert and review scheduling are independent —
    // run concurrently.
    await Promise.all([
      db
        .from('quizzes')
        .update({ status: 'completed', score, completed_at: new Date().toISOString() })
        .eq('id', quizId),
      AnalyticsService.recordQuizCompletion(
        quiz.user_id,
        quizId,
        score,
        quiz.material_id,
        quiz.total_questions,
        correctCount
      ),
      // Scheduling is a side benefit of finishing a quiz, not part of it — a
      // failure here must not cost the user their score.
      ReviewService.seedFromQuiz(userId, quizId).catch(error => {
        console.error('Failed to schedule reviews for quiz', quizId, error)
      }),
    ])

    return {
      quizId,
      score,
      correctCount,
      totalQuestions: quiz.total_questions,
      answers: formatAnswers(),
      completedAt: new Date().toISOString(),
    }
  }

  static async getResults(userId: string, quizId: string): Promise<QuizResults> {
    const db = getSupabaseAdmin()

    const [{ data: quiz }, { data: answers }] = await Promise.all([
      db.from('quizzes').select('*').eq('id', quizId).single(),
      db.from('answers').select('*').eq('quiz_id', quizId).order('answered_at'),
    ])

    if (!quiz || quiz.user_id !== userId) throw new Error('Quiz not found')

    const rows = answers || []
    return {
      quizId: quiz.id,
      score: quiz.score ?? 0,
      correctCount: rows.filter((a) => a.is_correct).length,
      totalQuestions: quiz.total_questions,
      answers: rows.map((a) => ({
        id: a.id,
        quizId: a.quiz_id,
        questionId: a.question_id,
        userAnswer: a.user_answer,
        isCorrect: a.is_correct,
        feedback: a.feedback,
        answeredAt: a.answered_at || new Date().toISOString(),
      })),
      completedAt: quiz.completed_at || new Date().toISOString(),
    }
  }

  static async retakeQuiz(userId: string, quizId: string): Promise<Quiz> {
    const db = getSupabaseAdmin()

    const { data: quiz } = await db
      .from('quizzes')
      .select('user_id')
      .eq('id', quizId)
      .single()

    if (!quiz || quiz.user_id !== userId) throw new Error('Quiz not found')

    // Clear prior attempt and reopen the quiz.
    await db.from('answers').delete().eq('quiz_id', quizId)
    const { error } = await db
      .from('quizzes')
      .update({ status: 'in_progress', score: null, completed_at: null })
      .eq('id', quizId)
    if (error) throw new Error(error.message)

    return this.getQuiz(quizId)
  }
}
