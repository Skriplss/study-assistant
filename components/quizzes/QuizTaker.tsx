'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/auth/session'
import { fetchWithAuth } from '@/lib/api/fetch-with-auth'
import type { Quiz, Answer } from '@/lib/types'

interface QuizTakerProps {
  quiz: Quiz
  onComplete: () => void
}

export function QuizTaker({ quiz, onComplete }: QuizTakerProps) {
  const { session } = useAuth()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Map<string, Answer>>(new Map())
  const [userAnswer, setUserAnswer] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const currentQuestion = quiz.questions[currentIndex]

  if (!currentQuestion) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">No questions found in this quiz.</p>
      </div>
    )
  }

  const currentAnswer = answers.get(currentQuestion.id)
  const isAnswered = !!currentAnswer

  const handleSubmit = async () => {
    if (!userAnswer.trim() || submitting || !session) return

    setSubmitting(true)
    try {
      const res = await fetchWithAuth(session, `/api/quizzes/${quiz.id}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: currentQuestion.id,
          answer: userAnswer,
        }),
      })

      if (!res.ok) throw new Error('Failed to submit answer')

      const data = await res.json()
      const answer: Answer = data.answer ?? data
      setAnswers(new Map(answers.set(currentQuestion.id, answer)))
    } catch {
      alert('Failed to submit answer')
    } finally {
      setSubmitting(false)
    }
  }

  const handleNext = () => {
    if (currentIndex < quiz.questions.length - 1) {
      setCurrentIndex(currentIndex + 1)
      const nextAnswer = answers.get(quiz.questions[currentIndex + 1].id)
      setUserAnswer(nextAnswer?.userAnswer || '')
    }
  }

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
      const prevAnswer = answers.get(quiz.questions[currentIndex - 1].id)
      setUserAnswer(prevAnswer?.userAnswer || '')
    }
  }

  const handleFinish = async () => {
    if (!session) return
    try {
      const res = await fetchWithAuth(session, `/api/quizzes/${quiz.id}/complete`, {
        method: 'POST',
      })

      if (!res.ok) throw new Error('Failed to complete quiz')

      onComplete()
    } catch {
      alert('Failed to complete quiz')
    }
  }

  const progress = ((currentIndex + 1) / quiz.questions.length) * 100

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="mb-6">
        <div className="flex justify-between text-sm text-gray-600 mb-2">
          <span>Question {currentIndex + 1} of {quiz.questions.length}</span>
          <span>{answers.size} answered</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-xl font-semibold">{currentQuestion.questionText}</h2>
          <span className={`px-2 py-1 rounded text-sm ${
            currentQuestion.difficulty === 'easy' ? 'bg-green-100 text-green-800' :
            currentQuestion.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-800' :
            'bg-red-100 text-red-800'
          }`}>
            {currentQuestion.difficulty}
          </span>
        </div>

        {currentQuestion.questionType === 'multiple_choice' && currentQuestion.options ? (
          <div className="space-y-2">
            {currentQuestion.options.map((option) => (
              <label
                key={option}
                className={`block p-4 border-2 rounded cursor-pointer transition ${
                  userAnswer === option
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-300 hover:border-gray-400'
                } ${isAnswered ? 'cursor-not-allowed opacity-60' : ''}`}
              >
                <input
                  type="radio"
                  name="answer"
                  value={option}
                  checked={userAnswer === option}
                  onChange={(e) => setUserAnswer(e.target.value)}
                  disabled={isAnswered}
                  className="mr-3"
                />
                {option}
              </label>
            ))}
          </div>
        ) : (
          <textarea
            value={userAnswer}
            onChange={(e) => setUserAnswer(e.target.value)}
            disabled={isAnswered}
            className="w-full p-4 border-2 border-gray-300 rounded focus:border-blue-500 focus:outline-none disabled:bg-gray-50 disabled:cursor-not-allowed"
            rows={4}
            placeholder="Type your answer here..."
          />
        )}

        {!isAnswered && (
          <button
            onClick={handleSubmit}
            disabled={!userAnswer.trim() || submitting}
            className="mt-4 px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {submitting ? 'Submitting...' : 'Submit Answer'}
          </button>
        )}

        {isAnswered && currentAnswer && (
          <div className={`mt-4 p-4 rounded ${
            currentAnswer.isCorrect ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              {currentAnswer.isCorrect ? (
                <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              )}
              <span className={`font-semibold ${currentAnswer.isCorrect ? 'text-green-800' : 'text-red-800'}`}>
                {currentAnswer.isCorrect ? 'Correct!' : 'Incorrect'}
              </span>
            </div>
            {currentAnswer.feedback && (
              <p className="text-sm text-gray-700 mt-2">{currentAnswer.feedback}</p>
            )}
          </div>
        )}
      </div>

      <div className="flex justify-between">
        <button
          onClick={handlePrevious}
          disabled={currentIndex === 0}
          className="px-6 py-2 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Previous
        </button>

        {currentIndex < quiz.questions.length - 1 ? (
          <button
            onClick={handleNext}
            className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Next
          </button>
        ) : (
          <button
            onClick={handleFinish}
            disabled={answers.size < quiz.questions.length}
            className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            Finish Quiz
          </button>
        )}
      </div>
    </div>
  )
}
