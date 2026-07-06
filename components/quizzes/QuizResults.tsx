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
    <div className="max-w-4xl mx-auto p-4 sm:p-6">
      <div className="mb-10 border-b border-border pb-8">
        <div className="flex items-baseline gap-4">
          <span className="font-serif text-6xl sm:text-7xl leading-none text-foreground">
            {percentage}%
          </span>
          <span className={`text-sm font-medium ${isPassed ? 'text-green-700 dark:text-green-400' : 'text-primary'}`}>
            {isPassed ? 'Passed' : 'Below passing'}
          </span>
        </div>
        <p className="mt-3 text-muted-foreground">
          {results.correctCount} of {results.totalQuestions} answered correctly
          {isPassed ? '.' : ' — worth another pass.'}
        </p>
      </div>

      <div className="flex gap-3 mb-10">
        {onBack && (
          <button
            onClick={onBack}
            className="flex-1 px-6 py-3 border border-border bg-card text-card-foreground rounded-lg hover:bg-accent font-medium transition-colors"
          >
            Back to Materials
          </button>
        )}
        {onRetake && (
          <button
            onClick={onRetake}
            className="flex-1 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 font-medium transition-colors"
          >
            Retake Quiz
          </button>
        )}
      </div>

      <div className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4">Review</h2>
        
        {questions.map((question, index) => {
          const answer = results.answers.find(a => a.questionId === question.id)
          if (!answer) return null

          return (
            <div key={question.id} className="bg-card border border-border rounded-lg p-4 sm:p-6">
              <div className="flex items-start gap-4 mb-4">
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm ${
                  answer.isCorrect
                    ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200'
                    : 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200'
                }`}>
                  {index + 1}
                </div>
                <div className="flex-1">
                  <LatexRenderer
                    content={question.questionText}
                    className="font-semibold text-lg mb-3 text-card-foreground"
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

              <div className="sm:ml-14 space-y-4">
                <div>
                  <span className="text-sm font-bold text-muted-foreground uppercase tracking-wide">Your answer:</span>
                  <div className={`mt-2 p-4 rounded-lg border font-medium ${
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
                    <div className="mt-2 p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg font-medium text-green-900 dark:text-green-100">
                      <LatexRenderer content={question.correctAnswer} />
                    </div>
                  </div>
                )}

                {answer.feedback && (
                  <div className="p-4 bg-muted border border-border rounded-lg">
                    <span className="text-sm font-bold text-primary uppercase tracking-wide">Explanation:</span>
                    <LatexRenderer 
                      content={answer.feedback} 
                      className="text-sm text-muted-foreground mt-2 leading-relaxed"
                    />
                  </div>
                )}

                {question.explanation && !answer.feedback && (
                  <div className="p-4 bg-muted border border-border rounded-lg">
                    <span className="text-sm font-bold text-primary uppercase tracking-wide">Explanation:</span>
                    <LatexRenderer 
                      content={question.explanation} 
                      className="text-sm text-muted-foreground mt-2 leading-relaxed"
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
