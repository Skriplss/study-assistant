'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth/session'
import { fetchWithAuth } from '@/lib/api/fetch-with-auth'
import { LatexRenderer } from '@/components/ui/LatexRenderer'
import { useToast } from '@/components/ui/Toast'
import type { ReviewCard, ReviewGradeResult } from '@/lib/types'

const describeInterval = (days: number) =>
  days === 1 ? 'tomorrow' : days < 30 ? `in ${days} days` : `in ${Math.round(days / 30)} months`

export default function ReviewSession() {
  const { session } = useAuth()
  const { toast } = useToast()

  const [cards, setCards] = useState<ReviewCard[]>([])
  const [index, setIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [userAnswer, setUserAnswer] = useState('')
  const [result, setResult] = useState<ReviewGradeResult | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [reviewed, setReviewed] = useState({ correct: 0, total: 0 })

  const loadDue = useCallback(async () => {
    if (!session) return

    setLoading(true)
    setError('')

    try {
      const response = await fetchWithAuth(session, '/api/review/due')
      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to load reviews')
        return
      }

      setCards(data.cards ?? [])
    } catch {
      setError('Failed to load reviews')
    } finally {
      setLoading(false)
    }
  }, [session])

  useEffect(() => {
    loadDue()
  }, [loadDue])

  const card = cards[index]

  const handleSubmit = async () => {
    if (!session || !card || !userAnswer.trim()) return

    setSubmitting(true)
    try {
      const response = await fetchWithAuth(session, '/api/review/grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId: card.questionId, userAnswer }),
      })
      const data = await response.json()

      if (!response.ok) {
        toast({ message: data.error || 'Failed to grade answer', variant: 'error' })
        return
      }

      setResult(data)
      setReviewed(prev => ({
        correct: prev.correct + (data.isCorrect ? 1 : 0),
        total: prev.total + 1,
      }))
    } catch {
      toast({ message: 'Failed to grade answer', variant: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  const handleNext = () => {
    setResult(null)
    setUserAnswer('')
    setIndex(i => i + 1)
  }

  if (loading) {
    return <p className="py-16 text-center text-muted-foreground">Loading reviews…</p>
  }

  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <p className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      </div>
    )
  }

  // Nothing due is the steady state, not an error — most days there's no backlog.
  if (cards.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">Nothing to review</h1>
        <p className="mx-auto mt-3 max-w-md text-muted-foreground">
          Questions come back here on a schedule after you answer them in a quiz — sooner
          if you got them wrong, later each time you get them right.
        </p>
        <Link
          href="/quizzes"
          className="mt-6 inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Go to quizzes
        </Link>
      </div>
    )
  }

  if (!card) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">Session complete</h1>
        <p className="mt-3 text-muted-foreground">
          {reviewed.correct} of {reviewed.total} correct. Each one is rescheduled.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <button
            type="button"
            onClick={() => {
              setIndex(0)
              setReviewed({ correct: 0, total: 0 })
              loadDue()
            }}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Check for more
          </button>
          <Link
            href="/dashboard"
            className="rounded-md bg-secondary px-4 py-2 text-sm font-medium hover:bg-secondary/80"
          >
            Back to overview
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-6">
      <div className="mb-6 flex items-center justify-between text-sm text-muted-foreground">
        <span className="font-medium">
          {index + 1} of {cards.length} due
        </span>
        {reviewed.total > 0 && (
          <span className="font-medium">
            {reviewed.correct}/{reviewed.total} correct
          </span>
        )}
      </div>

      <div className="mb-6 h-3 w-full overflow-hidden rounded-full bg-secondary shadow-inner">
        <div
          className="h-3 rounded-full bg-primary transition-all duration-500 ease-out"
          style={{ width: `${(index / cards.length) * 100}%` }}
        />
      </div>

      <div className="mb-6 rounded-xl border border-border bg-card p-5 shadow-lg sm:p-8">
        {card.materialTitle && (
          <p className="mb-3 truncate text-xs font-medium text-muted-foreground">
            {card.materialTitle}
          </p>
        )}

        <div className="mb-6 flex items-start justify-between gap-2">
          <LatexRenderer
            content={card.questionText}
            className="min-w-0 flex-1 text-lg font-bold text-foreground sm:text-2xl"
          />
          <span
            className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${
              card.difficulty === 'easy'
                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                : card.difficulty === 'medium'
                  ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                  : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
            }`}
          >
            {card.difficulty}
          </span>
        </div>

        {card.questionType === 'multiple_choice' && card.options ? (
          <div className="space-y-3">
            {card.options.map(option => (
              <label
                key={option}
                className={`block cursor-pointer rounded-lg border-2 p-4 transition-all ${
                  userAnswer === option
                    ? 'border-primary bg-primary/10 shadow-md'
                    : 'border-border hover:border-primary/50 hover:bg-accent'
                } ${result ? 'cursor-not-allowed opacity-60' : ''}`}
              >
                <input
                  type="radio"
                  name="review-answer"
                  value={option}
                  checked={userAnswer === option}
                  onChange={e => setUserAnswer(e.target.value)}
                  disabled={!!result}
                  className="mr-3 accent-primary"
                />
                <LatexRenderer content={option} className="inline text-foreground" />
              </label>
            ))}
          </div>
        ) : (
          <textarea
            value={userAnswer}
            onChange={e => setUserAnswer(e.target.value)}
            disabled={!!result}
            rows={5}
            placeholder="Type your answer here..."
            className="w-full rounded-lg border-2 border-border bg-background p-4 text-foreground transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:bg-muted"
          />
        )}

        {!result && (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!userAnswer.trim() || submitting}
            className="mt-6 rounded-lg bg-primary px-8 py-3 font-semibold text-primary-foreground shadow-md transition-all hover:bg-primary/90 hover:shadow-lg disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
          >
            {submitting ? 'Checking...' : 'Submit answer'}
          </button>
        )}

        {result && (
          <div
            className={`mt-6 rounded-lg border-2 p-5 ${
              result.isCorrect
                ? 'border-green-400 bg-green-50 dark:border-green-700 dark:bg-green-950'
                : 'border-red-400 bg-red-50 dark:border-red-700 dark:bg-red-950'
            }`}
          >
            <p
              className={`font-semibold ${
                result.isCorrect
                  ? 'text-green-800 dark:text-green-200'
                  : 'text-red-800 dark:text-red-200'
              }`}
            >
              {result.isCorrect ? 'Correct' : 'Incorrect'}
            </p>

            {!result.isCorrect && (
              <div className="mt-3">
                <p className="text-xs font-medium text-muted-foreground">Correct answer</p>
                <LatexRenderer content={result.correctAnswer} className="text-foreground" />
              </div>
            )}

            {result.feedback && (
              <p className="mt-3 text-sm text-foreground">{result.feedback}</p>
            )}

            {result.explanation && (
              <div className="mt-3">
                <p className="text-xs font-medium text-muted-foreground">Explanation</p>
                <LatexRenderer content={result.explanation} className="text-sm text-foreground" />
              </div>
            )}

            <p className="mt-4 text-xs text-muted-foreground">
              Next review {describeInterval(result.intervalDays)}.
            </p>

            <button
              type="button"
              onClick={handleNext}
              className="mt-4 rounded-lg bg-primary px-6 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              {index + 1 < cards.length ? 'Next question' : 'Finish'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
