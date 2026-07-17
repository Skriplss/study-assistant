'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth/session'
import { fetchWithAuth } from '@/lib/api/fetch-with-auth'
import type { QuizSummary } from '@/lib/types'
import { cn } from '@/lib/utils/cn'

type StatusFilter = 'all' | 'completed' | 'unfinished'

const STATUS_LABEL: Record<QuizSummary['status'], string> = {
  draft: 'Not started',
  in_progress: 'In progress',
  completed: 'Completed',
}

const scoreColor = (score: number) =>
  score >= 80
    ? 'text-green-600 dark:text-green-400'
    : score >= 50
      ? 'text-yellow-600 dark:text-yellow-400'
      : 'text-destructive'

export default function QuizHistoryList() {
  const { session } = useAuth()
  const [quizzes, setQuizzes] = useState<QuizSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  const loadQuizzes = useCallback(async () => {
    if (!session) return

    setLoading(true)
    setError('')

    try {
      const response = await fetchWithAuth(session, '/api/quizzes')
      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to load quizzes')
        return
      }

      setQuizzes(data.quizzes ?? [])
    } catch {
      setError('Failed to load quizzes')
    } finally {
      setLoading(false)
    }
  }, [session])

  useEffect(() => {
    loadQuizzes()
  }, [loadQuizzes])

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return quizzes
    if (statusFilter === 'completed') return quizzes.filter(q => q.status === 'completed')
    return quizzes.filter(q => q.status !== 'completed')
  }, [quizzes, statusFilter])

  const completed = useMemo(
    () => quizzes.filter(q => q.status === 'completed' && q.score !== null),
    [quizzes]
  )

  const averageScore = completed.length
    ? Math.round(
        (completed.reduce((sum, q) => sum + (q.score ?? 0), 0) / completed.length) * 10
      ) / 10
    : null

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Quizzes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {quizzes.length} total
            {averageScore !== null && ` · ${averageScore}% average across ${completed.length} completed`}
          </p>
        </div>
        <Link
          href="/materials"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          New quiz
        </Link>
      </div>

      <div className="mb-4 flex gap-1">
        {(['all', 'completed', 'unfinished'] as StatusFilter[]).map(status => (
          <button
            key={status}
            type="button"
            onClick={() => setStatusFilter(status)}
            className={cn(
              'rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors',
              statusFilter === status
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary hover:bg-secondary/80'
            )}
          >
            {status}
          </button>
        ))}
      </div>

      {error && (
        <p className="mb-4 rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {loading ? (
        <p className="py-12 text-center text-muted-foreground">Loading quizzes…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-16 text-center">
          <p className="mb-4 text-muted-foreground">
            {quizzes.length === 0 ? 'No quizzes yet.' : 'No quizzes match this filter.'}
          </p>
          {quizzes.length === 0 && (
            <Link href="/materials" className="font-medium text-primary hover:underline">
              Generate one from a material
            </Link>
          )}
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map(quiz => (
            <li key={quiz.id}>
              <Link
                href={`/quizzes/${quiz.id}`}
                className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/50"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{quiz.title}</p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {quiz.materialTitle ?? 'Material deleted'} · {quiz.totalQuestions} questions ·{' '}
                    {quiz.difficulty} ·{' '}
                    {new Date(quiz.completedAt ?? quiz.createdAt).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  {quiz.status === 'completed' && quiz.score !== null ? (
                    <span className={cn('text-lg font-semibold', scoreColor(quiz.score))}>
                      {Math.round(quiz.score)}%
                    </span>
                  ) : (
                    <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-muted-foreground">
                      {STATUS_LABEL[quiz.status]}
                    </span>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
