'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { QuizTaker } from '@/components/quizzes/QuizTaker'
import { QuizResults } from '@/components/quizzes/QuizResults'
import { useAuth } from '@/lib/auth/session'
import { fetchWithAuth } from '@/lib/api/fetch-with-auth'
import { Spinner } from '@/components/ui/Spinner'
import type { Quiz, QuizResults as Results } from '@/lib/types'

export default function QuizPage() {
  const router = useRouter()
  const params = useParams()
  const quizId = params.id as string
  const { session } = useAuth()

  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [results, setResults] = useState<Results | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (session) loadQuiz()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizId, session])

  const loadQuiz = async () => {
    if (!session) return
    try {
      const res = await fetchWithAuth(session, `/api/quizzes/${quizId}`)
      if (!res.ok) throw new Error('Failed to load quiz')

      const data = await res.json()
      const quiz = data.quiz ?? data
      setQuiz(quiz)

      if (quiz.status === 'completed') {
        const resRes = await fetchWithAuth(
          session,
          `/api/quizzes/${quizId}/results`
        )
        if (resRes.ok) {
          const resultsData = await resRes.json()
          setResults(resultsData)
        }
      }
    } catch {
      setError('Failed to load quiz')
    } finally {
      setLoading(false)
    }
  }

  const handleComplete = () => {
    loadQuiz()
  }

  const handleRetake = async () => {
    if (!session) return
    const res = await fetchWithAuth(session, `/api/quizzes/${quizId}/retake`, {
      method: 'POST',
    })
    if (res.ok) {
      // Stay on the loader until the reopened quiz arrives — QuizTaker hydrates
      // its answers from the quiz prop once at mount, so mounting it against the
      // stale completed quiz would lock every question with the old answers.
      setLoading(true)
      setResults(null)
      await loadQuiz()
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <Spinner size="lg" className="mx-auto mb-4 text-primary" />
          <p className="font-medium text-muted-foreground">Loading quiz...</p>
        </div>
      </div>
    )
  }

  if (error || !quiz) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="max-w-md rounded-xl border border-border bg-card p-8 text-center shadow-lg">
          <svg
            className="mx-auto mb-4 h-16 w-16 text-destructive"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="mb-6 text-lg font-semibold text-destructive">
            {error || 'Quiz not found'}
          </p>
          <button
            onClick={() => router.push('/dashboard')}
            className="rounded-lg bg-primary px-6 py-3 font-semibold text-primary-foreground shadow-md transition-all hover:bg-primary/90 hover:shadow-lg"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="mx-auto max-w-7xl px-4">
        <div className="mb-8 rounded-xl border border-border bg-card p-6 shadow-lg">
          <h1 className="mb-4 text-3xl font-bold text-foreground">
            {quiz.title}
          </h1>
          <div className="flex flex-wrap gap-3 text-sm">
            <span
              className={`rounded-full px-3 py-1.5 font-semibold ${
                quiz.difficulty === 'easy'
                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                  : quiz.difficulty === 'medium'
                    ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                    : quiz.difficulty === 'hard'
                      ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                      : 'bg-secondary text-secondary-foreground'
              }`}
            >
              {quiz.difficulty.charAt(0).toUpperCase() +
                quiz.difficulty.slice(1)}
            </span>
            <span className="rounded-full bg-secondary px-3 py-1.5 font-semibold text-foreground">
              {quiz.totalQuestions}{' '}
              {quiz.totalQuestions === 1 ? 'question' : 'questions'}
            </span>
            {quiz.status === 'completed' && quiz.score !== null && (
              <span className="rounded-full bg-primary px-3 py-1.5 font-semibold text-primary-foreground">
                Score: {Math.round(quiz.score)}%
              </span>
            )}
          </div>
        </div>

        {quiz.status === 'completed' && results ? (
          <QuizResults
            results={results}
            questions={quiz.questions}
            onBack={() => router.push('/materials')}
            onRetake={handleRetake}
          />
        ) : (
          <QuizTaker quiz={quiz} onComplete={handleComplete} />
        )}
      </div>
    </div>
  )
}
