'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useAuth } from '@/lib/auth/session'
import { fetchWithAuth } from '@/lib/api/fetch-with-auth'
import type { StudyMaterial } from '@/lib/types'
import MaterialCard from '@/components/materials/MaterialCard'
import { Skeleton } from '@/components/ui/Skeleton'

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

    try {
      const response = await fetchWithAuth(session, `/api/materials/${id}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        setError(data.error || 'Failed to delete material')
        return
      }
      window.location.href = '/materials'
    } catch {
      setError('Failed to delete material')
    }
  }

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <div className="space-y-3">
          <Skeleton className="h-9 w-1/3" />
          <Skeleton className="h-4 w-1/4" />
        </div>
        <div className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
    )
  }

  if (error && !material) {
    return (
      <div className="mx-auto w-full max-w-7xl space-y-4 px-4 py-8 sm:px-6 lg:px-8">
        <p className="text-destructive">{error}</p>
        <Link
          href="/materials"
          className="inline-block text-primary hover:underline"
        >
          Back to materials
        </Link>
      </div>
    )
  }

  if (!material) return null

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href="/materials"
        className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
      >
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

      {material.parsingStatus !== 'completed' && (
        <div className="flex items-center gap-3">
          {/* 'processing' gets the button too — a parse killed by a platform
              timeout leaves that status behind forever, and the server 409s
              if a parse is genuinely still running. */}
          <button
            type="button"
            onClick={handleParse}
            disabled={isParsing}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isParsing
              ? 'Parsing…'
              : material.parsingStatus === 'processing'
                ? 'Retry parse'
                : 'Parse file'}
          </button>
        </div>
      )}

      {material.parsingStatus === 'completed' && (
        <div className="flex items-center gap-3">
          <Link
            href={`/chat?material=${material.id}`}
            className="inline-flex items-center gap-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            💬 Chat about this
          </Link>
        </div>
      )}

      {material.parsingStatus === 'completed' && material.parsedContent && (
        <section className="rounded-lg border border-border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold">
            Extracted content preview
          </h2>
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <div className="space-y-2 text-sm leading-relaxed text-foreground">
              {material.parsedContent
                .split('\n\n')
                .slice(0, 5)
                .map((paragraph, idx) => (
                  <p key={idx} className="line-clamp-3 text-foreground">
                    {paragraph}
                  </p>
                ))}
              {material.parsedContent.split('\n\n').length > 5 && (
                <p className="italic text-muted-foreground">
                  ... and {material.parsedContent.split('\n\n').length - 5} more
                  paragraphs
                </p>
              )}
            </div>
          </div>
        </section>
      )}

      {error && (
        <div className="rounded-md border border-destructive/20 bg-destructive/10 p-4">
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        </div>
      )}
    </div>
  )
}
