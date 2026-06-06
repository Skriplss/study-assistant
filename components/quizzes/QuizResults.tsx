'use client'

import { LatexRenderer } from '@/components/ui/LatexRenderer'
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
      <div className={`rounded-xl p-8 mb-8 text-center shadow-lg border-2 ${
        isPassed 
          ? 'bg-green-50 dark:bg-green-950 border-green-300 dark:border-green-800' 
          : 'bg-red-50 dark:bg-red-950 border-red-300 dark:border-red-800'
      }`}>
        <div className={`text-6xl font-bold mb-3 ${
          isPassed ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'
        }`}>
          {percentage}%
        </div>
        <div className="text-xl mb-4 text-card-foreground font-semibold">
          {results.correctCount} / {results.totalQuestions} correct
        </div>
        <div className={`text-2xl font-bold ${isPassed ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'}`}>
          {isPassed ? '🎉 Great job!' : '📚 Keep studying!'}
        </div>
      </div>

      <div className="flex gap-4 mb-8">
        {onBack && (
          <button
            onClick={onBack}
            className="flex-1 px-6 py-3 border-2 border-border bg-card text-card-foreground rounded-lg hover:bg-accent font-semibold transition-all shadow-md hover:shadow-lg"
          >
            Back to Materials
          </button>
        )}
        {onRetake && (
          <button
            onClick={onRetake}
            className="flex-1 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 font-semibold transition-all shadow-md hover:shadow-lg"
          >
            Retake Quiz
          </button>
        )}
      </div>

      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-card-foreground mb-6">Review Answers</h2>
        
        {questions.map((question, index) => {
          const answer = results.answers.find(a => a.questionId === question.id)
          if (!answer) return null

          return (
            <div key={question.id} className="bg-card border-2 border-border rounded-xl shadow-lg p-6">
              <div className="flex items-start gap-4 mb-4">
                <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg shadow-md ${
                  answer.isCorrect 
                    ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200' 
                    : 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200'
                }`}>
                  {index + 1}
                </div>
                <div className="flex-1">
                  <LatexRenderer 
                    content={question.questionText} 
                    className="font-bold text-lg mb-3 text-card-foreground"
                  />
                  <span className={`text-xs px-3 py-1.5 rounded-full font-semibold ${
                    question.difficulty === 'easy' ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' :
                    question.difficulty === 'medium' ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200' :
                    'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                  }`}>
                    {question.difficulty}
                  </span>
                </div>
              </div>

              <div className="ml-14 space-y-4">
                <div>
                  <span className="text-sm font-bold text-muted-foreground uppercase tracking-wide">Your answer:</span>
                  <div className={`mt-2 p-4 rounded-lg border-2 font-medium ${
                    answer.isCorrect 
                      ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800 text-green-900 dark:text-green-100' 
                      : 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800 text-red-900 dark:text-red-100'
                  }`}>
                    <LatexRenderer content={answer.userAnswer} />
                  </div>
                </div>

                {!answer.isCorrect && (
                  <div>
                    <span className="text-sm font-bold text-muted-foreground uppercase tracking-wide">Correct answer:</span>
                    <div className="mt-2 p-4 bg-green-50 dark:bg-green-950 border-2 border-green-200 dark:border-green-800 rounded-lg font-medium text-green-900 dark:text-green-100">
                      <LatexRenderer content={question.correctAnswer} />
                    </div>
                  </div>
                )}

                {answer.feedback && (
                  <div className="p-4 bg-blue-50 dark:bg-blue-950 border-2 border-blue-200 dark:border-blue-800 rounded-lg">
                    <span className="text-sm font-bold text-blue-900 dark:text-blue-200 uppercase tracking-wide">Explanation:</span>
                    <LatexRenderer 
                      content={answer.feedback} 
                      className="text-sm text-blue-800 dark:text-blue-300 mt-2 leading-relaxed"
                    />
                  </div>
                )}

                {question.explanation && !answer.feedback && (
                  <div className="p-4 bg-blue-50 dark:bg-blue-950 border-2 border-blue-200 dark:border-blue-800 rounded-lg">
                    <span className="text-sm font-bold text-blue-900 dark:text-blue-200 uppercase tracking-wide">Explanation:</span>
                    <LatexRenderer 
                      content={question.explanation} 
                      className="text-sm text-blue-800 dark:text-blue-300 mt-2 leading-relaxed"
                    />
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
