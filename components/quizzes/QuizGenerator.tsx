'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/auth/session'
import { fetchWithAuth } from '@/lib/api/fetch-with-auth'

interface QuizGeneratorProps {
  materialId: string
  onQuizGenerated: (quizId: string) => void
  onClose?: () => void
}

export default function QuizGenerator({
  materialId,
  onQuizGenerated,
  onClose,
}: QuizGeneratorProps) {
  const { session } = useAuth()
  const [questionCount, setQuestionCount] = useState(10)
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard' | 'mixed'>('mixed')
  const [language, setLanguage] = useState<'sk' | 'en' | 'ru'>('en')
  const [questionTypes, setQuestionTypes] = useState<('multiple_choice' | 'open_ended')[]>([
    'multiple_choice',
    'open_ended',
  ])
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState('')

  const handleGenerate = async () => {
    if (!session) return

    setIsGenerating(true)
    setError('')

    try {
      const response = await fetchWithAuth(session, '/api/quizzes/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          materialId,
          questionCount,
          difficulty,
          questionTypes,
          language,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to generate quiz')
        return
      }

      onQuizGenerated(data.quiz.id)
    } catch {
      setError('Failed to generate quiz')
    } finally {
      setIsGenerating(false)
    }
  }

  const toggleQuestionType = (type: 'multiple_choice' | 'open_ended') => {
    if (questionTypes.includes(type)) {
      if (questionTypes.length > 1) {
        setQuestionTypes(questionTypes.filter((t) => t !== type))
      }
    } else {
      setQuestionTypes([...questionTypes, type])
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-foreground">Generate Quiz</h2>

      <div>
        <label className="block text-sm font-semibold mb-3 text-foreground">
          Number of Questions: {questionCount}
        </label>
        <input
          type="range"
          min="5"
          max="50"
          value={questionCount}
          onChange={(e) => setQuestionCount(Number(e.target.value))}
          disabled={isGenerating}
          className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
        />
        <div className="flex justify-between text-xs text-muted-foreground mt-2">
          <span>5</span>
          <span>50</span>
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold mb-3 text-foreground">Difficulty</label>
        <div className="relative">
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value as 'easy' | 'medium' | 'hard' | 'mixed')}
            disabled={isGenerating}
            className="w-full px-4 py-3 border-2 border-border bg-card text-card-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary disabled:opacity-50 appearance-none cursor-pointer font-medium shadow-sm"
          >
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
            <option value="mixed">Mixed</option>
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-card-foreground">
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold mb-3 text-foreground">Quiz Language</label>
        <div className="relative">
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as 'sk' | 'en' | 'ru')}
            disabled={isGenerating}
            className="w-full px-4 py-3 border-2 border-border bg-card text-card-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary disabled:opacity-50 appearance-none cursor-pointer font-medium shadow-sm"
          >
            <option value="en">English</option>
            <option value="sk">Slovenčina</option>
            <option value="ru">Русский</option>
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-card-foreground">
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold mb-3 text-foreground">Question Types</label>
        <div className="space-y-3">
          <label className="flex items-center p-3 border-2 border-border bg-card rounded-lg cursor-pointer hover:bg-accent transition-colors">
            <input
              type="checkbox"
              checked={questionTypes.includes('multiple_choice')}
              onChange={() => toggleQuestionType('multiple_choice')}
              disabled={isGenerating}
              className="mr-3 w-5 h-5 accent-primary"
            />
            <span className="text-foreground font-medium">Multiple Choice</span>
          </label>
          <label className="flex items-center p-3 border-2 border-border bg-card rounded-lg cursor-pointer hover:bg-accent transition-colors">
            <input
              type="checkbox"
              checked={questionTypes.includes('open_ended')}
              onChange={() => toggleQuestionType('open_ended')}
              disabled={isGenerating}
              className="mr-3 w-5 h-5 accent-primary"
            />
            <span className="text-foreground font-medium">Open Ended</span>
          </label>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-destructive/10 border-2 border-destructive/30 rounded-lg text-destructive text-sm font-medium">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={handleGenerate}
          disabled={isGenerating || questionCount < 5 || questionCount > 50}
          className="flex-1 py-3 px-6 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground font-semibold shadow-lg hover:shadow-xl transition-all"
        >
          {isGenerating ? 'Generating...' : 'Generate Quiz'}
        </button>
        {onClose && (
          <button
            onClick={onClose}
            disabled={isGenerating}
            className="px-6 py-3 border-2 border-border bg-card text-foreground rounded-lg hover:bg-accent disabled:opacity-50 font-medium transition-all"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  )
}
