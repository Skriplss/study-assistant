'use client'

import { Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import QuizGenerator from '@/components/quizzes/QuizGenerator'

function QuizGenerateContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const materialId = searchParams.get('materialId')

  if (!materialId) {
    return (
      <div className="space-y-4 max-w-lg">
        <h1 className="text-2xl font-bold">Quiz generation</h1>
        <p className="text-gray-600">No material selected.</p>
        <Link href="/materials" className="text-blue-600 hover:underline text-sm">
          ← Back to materials
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-lg space-y-4">
      <div className="flex items-center gap-4">
        <Link href="/materials" className="text-blue-600 hover:underline text-sm">
          ← Back to materials
        </Link>
      </div>
      <QuizGenerator
        materialId={materialId}
        onQuizGenerated={(quizId) => router.push(`/quizzes/${quizId}`)}
      />
    </div>
  )
}

export default function QuizGeneratePage() {
  return (
    <Suspense fallback={<p className="text-gray-500">Loading…</p>}>
      <QuizGenerateContent />
    </Suspense>
  )
}
