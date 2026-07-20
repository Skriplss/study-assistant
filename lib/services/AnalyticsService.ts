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

  private static getPerformanceByTag(userId: string, startDate: Date): Promise<TagPerformance[]> {
    return this.getPerformance('get_performance_by_tag', 'tag', userId, startDate)
  }

  private static getPerformanceByCategory(
    userId: string,
    startDate: Date
  ): Promise<CategoryPerformance[]> {
    return this.getPerformance('get_performance_by_category', 'category', userId, startDate)
  }

  private static async getPerformance<K extends 'tag' | 'category'>(
    rpc: 'get_performance_by_tag' | 'get_performance_by_category',
    keyField: K,
    userId: string,
    startDate: Date
  ): Promise<Array<Record<K, string> & { averageScore: number; quizCount: number; questionCount: number }>> {
    const db = getSupabaseAdmin()

    const { data, error } = await db.rpc(rpc, {
      p_user_id: userId,
      p_start_date: startDate.toISOString(),
    })

    // An empty breakdown and a broken RPC look identical to the caller, which is
    // how a 42703 in one of these went unnoticed for its whole life. Log it.
    if (error) {
      console.error(`${rpc} failed:`, error)
      return []
    }

    if (!data) return []

    return (data as any[]).map((row) => ({
      [keyField]: row[keyField],
      averageScore: row.average_score,
      quizCount: row.quiz_count,
      questionCount: row.question_count,
    })) as Array<Record<K, string> & { averageScore: number; quizCount: number; questionCount: number }>
  }

  private static getStartDate(range: string): Date {
    const days = { '7d': 7, '30d': 30, '90d': 90, '1y': 365 }[range] ?? 30
    return new Date(Date.now() - days * 86_400_000)
  }
}
