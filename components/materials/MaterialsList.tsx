'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth/session'
import { fetchWithAuth } from '@/lib/api/fetch-with-auth'
import type { StudyMaterial } from '@/lib/types'
import MaterialCard from './MaterialCard'

export default function MaterialsList() {
  const { session } = useAuth()
  const [materials, setMaterials] = useState<StudyMaterial[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadMaterials = useCallback(async () => {
    if (!session) return

    setLoading(true)
    setError('')

    try {
      const response = await fetchWithAuth(session, '/api/materials')
      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to load materials')
        return
      }

      setMaterials(data.materials ?? [])
    } catch {
      setError('Failed to load materials')
    } finally {
      setLoading(false)
    }
  }, [session])

  useEffect(() => {
    loadMaterials()
  }, [loadMaterials])

  const handleDelete = async (id: string) => {
    if (!session) return
    if (!confirm('Delete this material? This cannot be undone.')) return

    try {
      const response = await fetchWithAuth(session, `/api/materials/${id}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        const data = await response.json()
        setError(data.error || 'Failed to delete material')
        return
      }
      setMaterials((prev) => prev.filter((m) => m.id !== id))
    } catch {
      setError('Failed to delete material')
    }
  }

  const handleGenerateQuiz = (materialId: string) => {
    window.location.href = `/quizzes/generate?materialId=${materialId}`
  }

  if (loading) {
    return (
      <p className="text-center text-gray-500 py-12">Loading materials…</p>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Study materials</h1>
        <Link
          href="/materials/upload"
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
        >
          Upload material
        </Link>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3">
          {error}
        </p>
      )}

      {materials.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-gray-300 rounded-lg">
          <p className="text-gray-600 mb-4">No materials yet.</p>
          <Link
            href="/materials/upload"
            className="text-blue-600 hover:underline font-medium"
          >
            Upload your first file
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {materials.map((material) => (
            <MaterialCard
              key={material.id}
              material={material}
              onDelete={handleDelete}
              onEdit={(updated) =>
                setMaterials((prev) =>
                  prev.map((m) => (m.id === updated.id ? updated : m))
                )
              }
              onGenerateQuiz={handleGenerateQuiz}
            />
          ))}
        </div>
      )}
    </div>
  )
}
