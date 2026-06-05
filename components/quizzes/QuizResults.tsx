'use client'

import type { QuizResults as Results } from '@/lib/types'

interface QuizResultsProps {
  results: Results
  questions: any[]
  onRetake?: () => void
  onBack?: () => void
}

export function QuizResults({ results, questions, onRetake, onBack }: QuizResultsProps) {
  const percentage = Math.round(results.score)
  const isPassed = percentage >= 70

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className={`rounded-lg p-8 mb-6 text-center ${
        isPassed ? 'bg-green-50 border-2 border-green-200' : 'bg-red-50 border-2 border-red-200'
      }`}>
        <div className="text-6xl font-bold mb-2">{percentage}%</div>
        <div className="text-xl mb-4">
          {results.correctCount} / {results.totalQuestions} correct
        </div>
        <div className={`text-lg font-semibold ${isPassed ? 'text-green-800' : 'text-red-800'}`}>
          {isPassed ? '🎉 Great job!' : '📚 Keep studying!'}
        </div>
      </div>

      <div className="flex gap-4 mb-6">
        {onBack && (
          <button
            onClick={onBack}
            className="flex-1 px-6 py-3 border border-gray-300 rounded hover:bg-gray-50"
          >
            Back to Materials
          </button>
        )}
        {onRetake && (
          <button
            onClick={onRetake}
            className="flex-1 px-6 py-3 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retake Quiz
          </button>
        )}
      </div>

      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Review Answers</h2>
        
        {questions.map((question, index) => {
          const answer = results.answers.find(a => a.questionId === question.id)
          if (!answer) return null

          return (
            <div key={question.id} className="bg-white rounded-lg shadow p-6">
              <div className="flex items-start gap-4 mb-4">
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                  answer.isCorrect ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  {index + 1}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold mb-2">{question.questionText}</h3>
                  <span className={`text-xs px-2 py-1 rounded ${
                    question.difficulty === 'easy' ? 'bg-green-100 text-green-800' :
                    question.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {question.difficulty}
                  </span>
                </div>
              </div>

              <div className="ml-12 space-y-3">
                <div>
                  <span className="text-sm font-medium text-gray-600">Your answer:</span>
                  <div className={`mt-1 p-3 rounded ${
                    answer.isCorrect ? 'bg-green-50' : 'bg-red-50'
                  }`}>
                    {answer.userAnswer}
                  </div>
                </div>

                {!answer.isCorrect && (
                  <div>
                    <span className="text-sm font-medium text-gray-600">Correct answer:</span>
                    <div className="mt-1 p-3 bg-green-50 rounded">
                      {question.correctAnswer}
                    </div>
                  </div>
                )}

                {answer.feedback && (
                  <div className="p-3 bg-blue-50 rounded">
                    <span className="text-sm font-medium text-blue-900">Explanation:</span>
                    <p className="text-sm text-blue-800 mt-1">{answer.feedback}</p>
                  </div>
                )}

                {question.explanation && !answer.feedback && (
                  <div className="p-3 bg-blue-50 rounded">
                    <span className="text-sm font-medium text-blue-900">Explanation:</span>
                    <p className="text-sm text-blue-800 mt-1">{question.explanation}</p>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
