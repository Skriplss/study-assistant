'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { QuizTaker } from '@/components/quizzes/QuizTaker'
import { QuizResults } from '@/components/quizzes/QuizResults'
import { useAuth } from '@/lib/auth/session'
import { fetchWithAuth } from '@/lib/api/fetch-with-auth'
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading quiz...</p>
        </div>
      </div>
    )
  }

  if (error || !quiz) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || 'Quiz not found'}</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">{quiz.title}</h1>
          <div className="flex gap-4 text-sm text-gray-600">
            <span>Difficulty: {quiz.difficulty}</span>
            <span>•</span>
            <span>{quiz.totalQuestions} questions</span>
          </div>
        </div>

        {quiz.status === 'completed' && results ? (
          <QuizResults
            results={results}
            questions={quiz.questions}
            onBack={() => router.push('/materials')}
          />
        ) : (
          <QuizTaker quiz={quiz} onComplete={handleComplete} />
        )}
      </div>
    </div>
  )
}
