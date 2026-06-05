'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

function QuizGenerateContent() {
  const searchParams = useSearchParams()
  const materialId = searchParams.get('materialId')

  return (
    <div className="space-y-4 max-w-lg">
      <h1 className="text-2xl font-bold">Quiz generation</h1>
      <p className="text-gray-600">
        The AI service is ready. Quiz configuration UI and persistence (task 8)
        will connect here next.
      </p>
      {materialId && (
        <p className="text-sm text-gray-500">
          Material ID:{' '}
          <code className="bg-gray-100 px-1 rounded">{materialId}</code>
        </p>
      )}
      <Link href="/materials" className="text-blue-600 hover:underline text-sm">
        ← Back to materials
      </Link>
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
