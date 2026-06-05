'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useAuth } from '@/lib/auth/session'
import { fetchWithAuth } from '@/lib/api/fetch-with-auth'
import type { StudyMaterial } from '@/lib/types'
import MaterialCard from '@/components/materials/MaterialCard'

export default function MaterialDetailPage() {
  const params = useParams()
  const materialId = params.id as string
  const { session } = useAuth()
  const [material, setMaterial] = useState<StudyMaterial | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isParsing, setIsParsing] = useState(false)

  const loadMaterial = useCallback(async () => {
    if (!session) return

    setLoading(true)
    setError('')

    try {
      const response = await fetchWithAuth(
        session,
        `/api/materials/${materialId}`
      )
      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Material not found')
        return
      }

      setMaterial(data.material)
    } catch {
      setError('Failed to load material')
    } finally {
      setLoading(false)
    }
  }, [session, materialId])

  useEffect(() => {
    loadMaterial()
  }, [loadMaterial])

  const handleParse = async () => {
    if (!session) return

    setIsParsing(true)
    setError('')

    try {
      const response = await fetchWithAuth(session, '/api/materials/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ materialId }),
      })
      const data = await response.json()

      if (!response.ok) {
        setError(data.details || data.error || 'Parsing failed')
      }

      await loadMaterial()
    } catch {
      setError('Parsing failed')
    } finally {
      setIsParsing(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!session) return
    if (!confirm('Delete this material?')) return

    const response = await fetchWithAuth(session, `/api/materials/${id}`, {
      method: 'DELETE',
    })
    if (response.ok) {
      window.location.href = '/materials'
    }
  }

  if (loading) {
    return <p className="text-gray-500">Loading…</p>
  }

  if (error && !material) {
    return (
      <div className="space-y-4">
        <p className="text-red-600">{error}</p>
        <Link href="/materials" className="text-blue-600 hover:underline">
          Back to materials
        </Link>
      </div>
    )
  }

  if (!material) return null

  return (
    <div className="space-y-6">
      <Link href="/materials" className="text-sm text-blue-600 hover:underline">
        ← Back to materials
      </Link>

      <MaterialCard
        material={material}
        onDelete={handleDelete}
        onEdit={setMaterial}
        onGenerateQuiz={(id) => {
          window.location.href = `/quizzes/generate?materialId=${id}`
        }}
      />

      {(material.parsingStatus === 'pending' ||
        material.parsingStatus === 'failed') && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleParse}
            disabled={isParsing}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 text-sm"
          >
            {isParsing ? 'Parsing…' : 'Parse file'}
          </button>
        </div>
      )}

      {material.parsingStatus === 'completed' && material.parsedContent && (
        <section className="border border-gray-200 rounded-lg p-4 bg-white">
          <h2 className="font-semibold mb-2">Extracted content preview</h2>
          <p className="text-sm text-gray-700 whitespace-pre-wrap line-clamp-12">
            {material.parsedContent.slice(0, 2000)}
            {material.parsedContent.length > 2000 ? '…' : ''}
          </p>
        </section>
      )}

      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
