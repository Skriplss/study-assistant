import 'server-only'

import { getSupabaseAdmin } from '@/lib/supabase/server'
import { ApiError } from '@/lib/api/errors'
import { AIService } from './AIService'
import type { Question, ReviewCard, ReviewGradeResult } from '@/lib/types'

/** SM-2 floors ease here; below it intervals stop growing usefully. */
const MIN_EASE_FACTOR = 1.3
const INITIAL_EASE_FACTOR = 2.5
const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * SM-2 grades recall 0-5 by self-report, but this app already judges answers
 * itself — deterministically for multiple choice, via AIService for open-ended —
 * so a review yields a verdict, not a rating. These are the two grades that keep
 * the algorithm's behaviour intact: 4 leaves ease untouched (the term cancels to
 * zero), 2 is a lapse that drops ease and restarts the interval.
 */
const GRADE_CORRECT = 4
const GRADE_INCORRECT = 2

interface Sm2State {
  easeFactor: number
  intervalDays: number
  repetitions: number
}

export class ReviewService {
  /**
   * One SM-2 step. Follows the original: the new interval is computed from the
   * *old* ease factor, and ease is updated afterwards.
   */
  static schedule(state: Sm2State, grade: number): Sm2State {
    let repetitions: number
    let intervalDays: number

    if (grade >= 3) {
      repetitions = state.repetitions + 1
      intervalDays =
        repetitions === 1
          ? 1
          : repetitions === 2
            ? 6
            : Math.round(state.intervalDays * state.easeFactor)
    } else {
      // A lapse restarts the ladder — tomorrow, from scratch.
      repetitions = 0
      intervalDays = 1
    }

    const easeFactor = Math.max(
      MIN_EASE_FACTOR,
      state.easeFactor + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02))
    )

    return { easeFactor, intervalDays, repetitions }
  }

  /**
   * Fold a finished quiz into the review schedule: every answered question gets
   * scheduled, with its first grade taken from whether the answer was right.
   * Questions already under review are advanced rather than reset, so a retake
   * counts as another repetition.
   */
  static async seedFromQuiz(userId: string, quizId: string): Promise<void> {
    const db = getSupabaseAdmin()

    const { data: answers } = await db
      .from('answers')
      .select('question_id, is_correct')
      .eq('quiz_id', quizId)

    if (!answers?.length) return

    const questionIds = answers.map(a => a.question_id)
    const { data: existing } = await db
      .from('review_items')
      .select('question_id, ease_factor, interval_days, repetitions')
      .eq('user_id', userId)
      .in('question_id', questionIds)

    const priorState = new Map(existing?.map(item => [item.question_id, item]))
    const now = new Date()

    const rows = answers.map(answer => {
      const prior = priorState.get(answer.question_id)
      const state: Sm2State = prior
        ? {
            easeFactor: Number(prior.ease_factor),
            intervalDays: prior.interval_days,
            repetitions: prior.repetitions,
          }
        : { easeFactor: INITIAL_EASE_FACTOR, intervalDays: 0, repetitions: 0 }

      const next = this.schedule(state, answer.is_correct ? GRADE_CORRECT : GRADE_INCORRECT)

      return {
        user_id: userId,
        question_id: answer.question_id,
        ease_factor: next.easeFactor,
        interval_days: next.intervalDays,
        repetitions: next.repetitions,
        next_review_at: new Date(now.getTime() + next.intervalDays * MS_PER_DAY).toISOString(),
        last_reviewed_at: now.toISOString(),
      }
    })

    const { error } = await db
      .from('review_items')
      .upsert(rows, { onConflict: 'user_id,question_id' })

    if (error) throw new Error(`Failed to schedule reviews: ${error.message}`)
  }

  static async countDue(userId: string): Promise<number> {
    const db = getSupabaseAdmin()

    const { count } = await db
      .from('review_items')
      .select('question_id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .lte('next_review_at', new Date().toISOString())

    return count || 0
  }

  static async getDue(userId: string, limit = 20): Promise<ReviewCard[]> {
    const db = getSupabaseAdmin()

    const { data: due, error } = await db
      .from('review_items')
      .select('question_id, next_review_at')
      .eq('user_id', userId)
      .lte('next_review_at', new Date().toISOString())
      .order('next_review_at')
      .limit(limit)

    if (error) throw new Error(error.message)
    if (!due?.length) return []

    // correct_answer is deliberately not selected — the client never needs it
    // until it has answered, and /api/review/grade returns it then.
    const { data: questions } = await db
      .from('questions')
      .select(
        'id, question_text, question_type, options, difficulty, quizzes(material_id, study_materials(title))'
      )
      .in(
        'id',
        due.map(d => d.question_id)
      )

    const byId = new Map((questions || []).map(q => [q.id, q]))

    return due
      .map(item => {
        const question = byId.get(item.question_id)
        if (!question) return null

        const quiz = question.quizzes as
          | { material_id: string; study_materials: { title: string } | { title: string }[] | null }
          | null
        const material = quiz?.study_materials
        const materialTitle = Array.isArray(material) ? material[0]?.title : material?.title

        return {
          questionId: question.id,
          questionText: question.question_text,
          questionType: question.question_type as ReviewCard['questionType'],
          options: Array.isArray(question.options) ? (question.options as string[]) : null,
          difficulty: (question.difficulty || 'medium') as ReviewCard['difficulty'],
          materialId: quiz?.material_id ?? null,
          materialTitle: materialTitle ?? null,
          dueAt: item.next_review_at,
        }
      })
      .filter((card): card is ReviewCard => card !== null)
  }

  static async grade(
    userId: string,
    questionId: string,
    userAnswer: string
  ): Promise<ReviewGradeResult> {
    const db = getSupabaseAdmin()

    // The review row is keyed by user_id, so finding it *is* the ownership check.
    const [{ data: item }, { data: question }] = await Promise.all([
      db
        .from('review_items')
        .select('ease_factor, interval_days, repetitions')
        .eq('user_id', userId)
        .eq('question_id', questionId)
        .single(),
      db.from('questions').select('*').eq('id', questionId).single(),
    ])

    if (!item) throw new ApiError('Review item not found', 404)
    if (!question) throw new ApiError('Question not found', 404)

    const formatted: Question = {
      id: question.id,
      quizId: question.quiz_id,
      questionText: question.question_text,
      questionType: question.question_type as Question['questionType'],
      difficulty: (question.difficulty || 'medium') as Question['difficulty'],
      options: Array.isArray(question.options) ? (question.options as string[]) : null,
      correctAnswer: question.correct_answer,
      explanation: question.explanation,
      orderIndex: question.order_index,
    }

    const verification = await AIService.verifyAnswer(formatted, userAnswer)

    const next = this.schedule(
      {
        easeFactor: Number(item.ease_factor),
        intervalDays: item.interval_days,
        repetitions: item.repetitions,
      },
      verification.isCorrect ? GRADE_CORRECT : GRADE_INCORRECT
    )

    const now = new Date()
    const nextReviewAt = new Date(now.getTime() + next.intervalDays * MS_PER_DAY).toISOString()

    const { error } = await db
      .from('review_items')
      .update({
        ease_factor: next.easeFactor,
        interval_days: next.intervalDays,
        repetitions: next.repetitions,
        next_review_at: nextReviewAt,
        last_reviewed_at: now.toISOString(),
      })
      .eq('user_id', userId)
      .eq('question_id', questionId)

    if (error) throw new Error(`Failed to save review: ${error.message}`)

    return {
      isCorrect: verification.isCorrect,
      feedback: verification.feedback,
      correctAnswer: question.correct_answer,
      explanation: question.explanation,
      nextReviewAt,
      intervalDays: next.intervalDays,
    }
  }
}
