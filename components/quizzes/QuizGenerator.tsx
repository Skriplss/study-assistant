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
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Generate Quiz</h2>

      <div>
        <label className="block text-sm font-medium mb-2">
          Number of Questions: {questionCount}
        </label>
        <input
          type="range"
          min="5"
          max="50"
          value={questionCount}
          onChange={(e) => setQuestionCount(Number(e.target.value))}
          disabled={isGenerating}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>5</span>
          <span>50</span>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Difficulty</label>
        <select
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value as 'easy' | 'medium' | 'hard' | 'mixed')}
          disabled={isGenerating}
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
        >
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
          <option value="mixed">Mixed</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Question Types</label>
        <div className="space-y-2">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={questionTypes.includes('multiple_choice')}
              onChange={() => toggleQuestionType('multiple_choice')}
              disabled={isGenerating}
              className="mr-2"
            />
            Multiple Choice
          </label>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={questionTypes.includes('open_ended')}
              onChange={() => toggleQuestionType('open_ended')}
              disabled={isGenerating}
              className="mr-2"
            />
            Open Ended
          </label>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={handleGenerate}
          disabled={isGenerating || questionCount < 5 || questionCount > 50}
          className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
        >
          {isGenerating ? 'Generating...' : 'Generate Quiz'}
        </button>
        {onClose && (
          <button
            onClick={onClose}
            disabled={isGenerating}
            className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  )
}
