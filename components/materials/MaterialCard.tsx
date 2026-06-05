'use client'

import { useEffect, useState } from 'react'
import type { StudyMaterial } from '@/lib/types'
import { useAuth } from '@/lib/auth/session'
import { fetchWithAuth } from '@/lib/api/fetch-with-auth'
import TagInput from './TagInput'
import CategorySelector from './CategorySelector'
import ParsingStatus from './ParsingStatus'
import type { TagEntry } from '@/lib/tags/tag-management'

export interface MaterialCardProps {
  material: StudyMaterial
  onDelete: (id: string) => void
  onEdit?: (material: StudyMaterial) => void
  onGenerateQuiz: (id: string) => void
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

const FILE_TYPE_LABELS: Record<StudyMaterial['fileType'], string> = {
  pdf: 'PDF',
  txt: 'Text',
  md: 'Markdown',
}

export default function MaterialCard({
  material,
  onDelete,
  onEdit,
  onGenerateQuiz,
}: MaterialCardProps) {
  const { session } = useAuth()
  const [isEditing, setIsEditing] = useState(false)
  const [title, setTitle] = useState(material.title)
  const [category, setCategory] = useState(material.category ?? '')
  const [tags, setTags] = useState(material.tags)
  const [tagSuggestions, setTagSuggestions] = useState<TagEntry[]>([])
  const [categorySuggestions, setCategorySuggestions] = useState<string[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    setTitle(material.title)
    setCategory(material.category ?? '')
    setTags(material.tags)
  }, [material])

  useEffect(() => {
    if (!isEditing || !session) return

    const loadSuggestions = async () => {
      try {
        const [tagsRes, categoriesRes] = await Promise.all([
          fetchWithAuth(session, '/api/tags'),
          fetchWithAuth(session, '/api/categories'),
        ])

        if (tagsRes.ok) {
          const data = await tagsRes.json()
          setTagSuggestions(data.tags ?? [])
        }
        if (categoriesRes.ok) {
          const data = await categoriesRes.json()
          setCategorySuggestions(
            (data.categories ?? []).map(
              (entry: { category: string }) => entry.category
            )
          )
        }
      } catch {
        // Suggestions are optional; editing still works without them
      }
    }

    loadSuggestions()
  }, [isEditing, session])

  const handleCancelEdit = () => {
    setTitle(material.title)
    setCategory(material.category ?? '')
    setTags(material.tags)
    setSaveError('')
    setIsEditing(false)
  }

  const handleSave = async () => {
    if (!session) return

    setIsSaving(true)
    setSaveError('')

    try {
      const response = await fetchWithAuth(
        session,
        `/api/materials/${material.id}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: title.trim(),
            category: category.trim() || null,
            tags,
          }),
        }
      )

      const data = await response.json()
      if (!response.ok) {
        setSaveError(data.error || 'Failed to save changes')
        return
      }

      setIsEditing(false)
      onEdit?.(data.material)
    } catch {
      setSaveError('Failed to save changes')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <article className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
            />
          ) : (
            <h3 className="font-semibold text-lg truncate">{material.title}</h3>
          )}
          <p className="text-sm text-gray-500 mt-1">
            {FILE_TYPE_LABELS[material.fileType]} · {formatFileSize(material.fileSize)} ·{' '}
            Uploaded {formatDate(material.createdAt)}
          </p>
        </div>

        {!isEditing && (
          <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded">
            {FILE_TYPE_LABELS[material.fileType]}
          </span>
        )}
      </div>

      <ParsingStatus material={material} />

      {isEditing ? (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Category</label>
            <CategorySelector
              value={category}
              onChange={setCategory}
              suggestions={categorySuggestions}
              disabled={isSaving}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Tags</label>
            <TagInput
              tags={tags}
              onChange={setTags}
              suggestions={tagSuggestions}
              disabled={isSaving}
            />
          </div>
          {saveError && (
            <p className="text-sm text-red-600" role="alert">
              {saveError}
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {material.category && (
            <p className="text-sm">
              <span className="font-medium text-gray-700">Category:</span>{' '}
              {material.category}
            </p>
          )}
          {material.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {material.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
        {isEditing ? (
          <>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || !title.trim()}
              className="px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
            >
              {isSaving ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={handleCancelEdit}
              disabled={isSaving}
              className="px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => onGenerateQuiz(material.id)}
              className="px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Generate quiz
            </button>
            <button
              type="button"
              onClick={() => onDelete(material.id)}
              className="px-3 py-2 text-sm text-red-600 border border-red-200 rounded-md hover:bg-red-50 ml-auto"
            >
              Delete
            </button>
          </>
        )}
      </div>
    </article>
  )
}
