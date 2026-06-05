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
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <div className="flex justify-between text-sm text-muted-foreground mb-3">
          <span className="font-medium">Question {currentIndex + 1} of {quiz.questions.length}</span>
          <span className="font-medium">{answers.size} answered</span>
        </div>
        <div className="w-full bg-secondary rounded-full h-3 overflow-hidden shadow-inner">
          <div
            className="bg-primary h-3 rounded-full transition-all duration-500 ease-out shadow-lg"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="bg-card rounded-xl shadow-lg border border-border p-8 mb-6">
        <div className="flex justify-between items-start mb-6">
          <h2 className="text-2xl font-bold text-foreground pr-4">{currentQuestion.questionText}</h2>
          <span className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
            currentQuestion.difficulty === 'easy' ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' :
            currentQuestion.difficulty === 'medium' ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200' :
            'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
          }`}>
            {currentQuestion.difficulty}
          </span>
        </div>

        {currentQuestion.questionType === 'multiple_choice' && currentQuestion.options ? (
          <div className="space-y-3">
            {currentQuestion.options.map((option) => (
              <label
                key={option}
                className={`block p-4 border-2 rounded-lg cursor-pointer transition-all ${
                  userAnswer === option
                    ? 'border-primary bg-primary/10 shadow-md'
                    : 'border-border hover:border-primary/50 hover:bg-accent'
                } ${isAnswered ? 'cursor-not-allowed opacity-60' : ''}`}
              >
                <input
                  type="radio"
                  name="answer"
                  value={option}
                  checked={userAnswer === option}
                  onChange={(e) => setUserAnswer(e.target.value)}
                  disabled={isAnswered}
                  className="mr-3 accent-primary"
                />
                <span className="text-foreground">{option}</span>
              </label>
            ))}
          </div>
        ) : (
          <textarea
            value={userAnswer}
            onChange={(e) => setUserAnswer(e.target.value)}
            disabled={isAnswered}
            className="w-full p-4 border-2 border-border bg-background text-foreground rounded-lg focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:bg-muted disabled:cursor-not-allowed transition-all"
            rows={5}
            placeholder="Type your answer here..."
          />
        )}

        {!isAnswered && (
          <button
            onClick={handleSubmit}
            disabled={!userAnswer.trim() || submitting}
            className="mt-6 px-8 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed font-semibold transition-all shadow-md hover:shadow-lg"
          >
            {submitting ? 'Submitting...' : 'Submit Answer'}
          </button>
        )}

        {isAnswered && currentAnswer && (
          <div className={`mt-6 p-5 rounded-lg border-2 ${
            currentAnswer.isCorrect 
              ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800' 
              : 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800'
          }`}>
            <div className="flex items-center gap-3 mb-2">
              {currentAnswer.isCorrect ? (
                <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              )}
              <span className={`font-bold text-lg ${currentAnswer.isCorrect ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'}`}>
                {currentAnswer.isCorrect ? 'Correct!' : 'Incorrect'}
              </span>
            </div>
            {currentAnswer.feedback && (
              <p className="text-sm text-foreground/80 mt-3 leading-relaxed">{currentAnswer.feedback}</p>
            )}
          </div>
        )}
      </div>

      <div className="flex justify-between">
        <button
          onClick={handlePrevious}
          disabled={currentIndex === 0}
          className="px-6 py-3 border-2 border-border bg-card text-foreground rounded-lg hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-all"
        >
          Previous
        </button>

        {currentIndex < quiz.questions.length - 1 ? (
          <button
            onClick={handleNext}
            className="px-8 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 font-semibold transition-all shadow-md hover:shadow-lg"
          >
            Next
          </button>
        ) : (
          <button
            onClick={handleFinish}
            disabled={answers.size < quiz.questions.length}
            className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed font-semibold transition-all shadow-md hover:shadow-lg"
          >
            Finish Quiz
          </button>
        )}
      </div>
    </div>
  )
}
