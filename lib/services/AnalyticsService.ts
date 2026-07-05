import 'server-only'

import { getSupabaseAdmin } from '@/lib/supabase/server'
import type { ProgressData, ScoreDataPoint, TagPerformance, CategoryPerformance } from '@/lib/types'

export class AnalyticsService {
  static async recordQuizCompletion(
    userId: string,
    quizId: string,
    score: number,
    materialId: string,
    questionsCount: number = 0,
    correctCount: number = 0
  ): Promise<void> {
    const db = getSupabaseAdmin()

    await db.from('progress_snapshots').insert({
      user_id: userId,
      quiz_id: quizId,
      material_id: materialId,
      score,
      questions_count: questionsCount,
      correct_count: correctCount,
      completed_at: new Date().toISOString(),
    })
  }

  static async getProgressData(
    userId: string,
    timeRange: '7d' | '30d' | '90d' | '1y' = '30d'
  ): Promise<ProgressData> {
    const db = getSupabaseAdmin()
    const startDate = this.getStartDate(timeRange)

    // All five reads are independent — run them concurrently.
    const [
      { data: snapshots },
      { data: materials },
      { data: quizzes },
      performanceByTag,
      performanceByCategory,
    ] = await Promise.all([
      db
        .from('progress_snapshots')
        .select('*')
        .eq('user_id', userId)
        .gte('completed_at', startDate.toISOString())
        .order('completed_at'),
      db.from('study_materials').select('id').eq('user_id', userId),
      db
        .from('quizzes')
        .select('id, total_questions')
        .eq('user_id', userId)
        .gte('created_at', startDate.toISOString()),
      this.getPerformanceByTag(userId, startDate),
      this.getPerformanceByCategory(userId, startDate),
    ])

    const scores = snapshots?.map(s => s.score) || []
    const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0

    return {
      totalMaterials: materials?.length || 0,
      totalQuizzes: quizzes?.length || 0,
      totalQuestions: quizzes?.reduce((sum, q) => sum + q.total_questions, 0) || 0,
      averageScore: Math.round(avgScore * 10) / 10,
      scoreHistory: this.formatScoreHistory(snapshots || []),
      performanceByTag,
      performanceByCategory,
    }
  }

  /**
   * Lightweight totals for the summary card — skips the two perf RPCs and the
   * full snapshot fetch that getProgressData does (and the summary discards).
   */
  static async getSummary(
    userId: string,
    timeRange: '7d' | '30d' | '90d' | '1y' = '30d'
  ): Promise<{
    totalMaterials: number
    totalQuizzes: number
    totalQuestions: number
    averageScore: number
  }> {
    const db = getSupabaseAdmin()
    const startDate = this.getStartDate(timeRange)

    const [{ data: scoreRows }, { count: materialCount }, { data: quizzes }] =
      await Promise.all([
        db
          .from('progress_snapshots')
          .select('score')
          .eq('user_id', userId)
          .gte('completed_at', startDate.toISOString()),
        db
          .from('study_materials')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId),
        db
          .from('quizzes')
          .select('id, total_questions')
          .eq('user_id', userId)
          .gte('created_at', startDate.toISOString()),
      ])

    const scores = scoreRows?.map(s => s.score) || []
    const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0

    return {
      totalMaterials: materialCount || 0,
      totalQuizzes: quizzes?.length || 0,
      totalQuestions: quizzes?.reduce((sum, q) => sum + q.total_questions, 0) || 0,
      averageScore: Math.round(avgScore * 10) / 10,
    }
  }

  private static formatScoreHistory(snapshots: any[]): ScoreDataPoint[] {
    return snapshots.map(s => ({
      date: s.completed_at,
      score: s.score,
      quizId: s.quiz_id,
    }))
  }

  private static async getPerformanceByTag(
    userId: string,
    startDate: Date
  ): Promise<TagPerformance[]> {
    const db = getSupabaseAdmin()

    const { data } = await db.rpc('get_performance_by_tag', {
      p_user_id: userId,
      p_start_date: startDate.toISOString(),
    })

    if (!data) return []

    return data.map((row: {
      tag: string
      average_score: number
      quiz_count: number
      question_count: number
    }) => ({
      tag: row.tag,
      averageScore: row.average_score,
      quizCount: row.quiz_count,
      questionCount: row.question_count,
    }))
  }

  private static async getPerformanceByCategory(
    userId: string,
    startDate: Date
  ): Promise<CategoryPerformance[]> {
    const db = getSupabaseAdmin()

    const { data } = await db.rpc('get_performance_by_category', {
      p_user_id: userId,
      p_start_date: startDate.toISOString(),
    })

    if (!data) return []

    return data.map((row: {
      category: string
      average_score: number
      quiz_count: number
      question_count: number
    }) => ({
      category: row.category,
      averageScore: row.average_score,
      quizCount: row.quiz_count,
      questionCount: row.question_count,
    }))
  }

  private static getStartDate(range: string): Date {
    const now = new Date()
    switch (range) {
      case '7d':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      case '30d':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      case '90d':
        return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
      case '1y':
        return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
      default:
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    }
  }
}
