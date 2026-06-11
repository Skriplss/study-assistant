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
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-4">
        <h1 className="text-2xl font-bold">Quiz generation</h1>
        <p className="text-muted-foreground">No material selected.</p>
        <Link href="/materials" className="text-primary hover:underline text-sm">
          ← Back to materials
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 sm:px-6 lg:px-8 py-8 space-y-4">
      <div className="flex items-center gap-4">
        <Link href="/materials" className="text-primary hover:underline text-sm">
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
    <Suspense fallback={
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    }>
      <QuizGenerateContent />
    </Suspense>
  )
}
