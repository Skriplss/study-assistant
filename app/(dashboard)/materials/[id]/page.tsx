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
    return (
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    )
  }

  if (error && !material) {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-4">
        <p className="text-destructive">{error}</p>
        <Link href="/materials" className="text-primary hover:underline inline-block">
          Back to materials
        </Link>
      </div>
    )
  }

  if (!material) return null

  return (
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <Link href="/materials" className="text-sm text-primary hover:underline inline-flex items-center gap-1">
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
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
          >
            {isParsing ? 'Parsing…' : 'Parse file'}
          </button>
        </div>
      )}

      {material.parsingStatus === 'completed' && material.parsedContent && (
        <section className="border border-border rounded-lg p-6 bg-card">
          <h2 className="font-semibold text-lg mb-4">Extracted content preview</h2>
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <div className="text-sm text-foreground leading-relaxed space-y-2">
              {material.parsedContent
                .split('\n\n')
                .slice(0, 5)
                .map((paragraph, idx) => (
                  <p key={idx} className="text-foreground line-clamp-3">
                    {paragraph}
                  </p>
                ))}
              {material.parsedContent.split('\n\n').length > 5 && (
                <p className="text-muted-foreground italic">
                  ... and {material.parsedContent.split('\n\n').length - 5} more paragraphs
                </p>
              )}
            </div>
          </div>
        </section>
      )}

      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-md">
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        </div>
      )}
    </div>
  )
}
