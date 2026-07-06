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
        const resRes = await fetchWithAuth(session, `/api/quizzes/${quizId}/results`)
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
      setResults(null)
      await loadQuiz()
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <Spinner size="lg" className="text-primary mx-auto mb-4" />
          <p className="text-muted-foreground font-medium">Loading quiz...</p>
        </div>
      </div>
    )
  }

  if (error || !quiz) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center bg-card border border-border rounded-xl p-8 shadow-lg max-w-md">
          <svg className="w-16 h-16 text-destructive mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-destructive mb-6 text-lg font-semibold">{error || 'Quiz not found'}</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 font-semibold shadow-md hover:shadow-lg transition-all"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="max-w-7xl mx-auto px-4">
        <div className="mb-8 bg-card border border-border rounded-xl p-6 shadow-lg">
          <h1 className="text-3xl font-bold mb-4 text-foreground">{quiz.title}</h1>
          <div className="flex flex-wrap gap-3 text-sm">
            <span className={`px-3 py-1.5 rounded-full font-semibold ${
              quiz.difficulty === 'easy' ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' :
              quiz.difficulty === 'medium' ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200' :
              quiz.difficulty === 'hard' ? 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200' :
              'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
            }`}>
              {quiz.difficulty.charAt(0).toUpperCase() + quiz.difficulty.slice(1)}
            </span>
            <span className="px-3 py-1.5 rounded-full bg-secondary text-foreground font-semibold">
              {quiz.totalQuestions} {quiz.totalQuestions === 1 ? 'question' : 'questions'}
            </span>
            {quiz.status === 'completed' && quiz.score !== null && (
              <span className="px-3 py-1.5 rounded-full bg-primary text-primary-foreground font-semibold">
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
