'use client'

import { memo, useEffect, useState } from 'react'
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
  pptx: 'PowerPoint',
  png: 'Image',
  jpg: 'Image',
  jpeg: 'Image',
}

function MaterialCard({
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
  const [isParsing, setIsParsing] = useState(false)
  const [currentMaterial, setCurrentMaterial] = useState(material)

  useEffect(() => {
    setTitle(material.title)
    setCategory(material.category ?? '')
    setTags(material.tags)
    setCurrentMaterial(material)
  }, [material])

  const handleParse = async () => {
    if (!session) return
    setIsParsing(true)
    try {
      const response = await fetchWithAuth(session, '/api/materials/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ materialId: currentMaterial.id }),
      })
      if (response.ok) {
        // Success implies parsing completed — no second round-trip needed.
        const updated = { ...currentMaterial, parsingStatus: 'completed' as const }
        setCurrentMaterial(updated)
        onEdit?.(updated)
      } else {
        const err = await response.json().catch(() => ({}))
        console.error('Parse failed:', err)
      }
    } catch {
      // ignore
    } finally {
      setIsParsing(false)
    }
  }

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
    <article className="border border-border rounded-lg p-4 bg-card hover:shadow-md transition-shadow">
      {/* Header with title and file type */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          <span className="inline-block px-2 py-1 text-xs font-medium bg-secondary text-secondary-foreground rounded flex-shrink-0">
            {FILE_TYPE_LABELS[currentMaterial.fileType]}
          </span>
          
          <div className="flex-1 min-w-0">
            {isEditing ? (
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-2 py-1 border border-border bg-background text-foreground rounded text-sm font-medium"
              />
            ) : (
              <h3 className="font-semibold text-sm text-foreground truncate">{currentMaterial.title}</h3>
            )}
            <p className="text-xs text-muted-foreground mt-0.5">
              {formatFileSize(currentMaterial.fileSize)} · {formatDate(currentMaterial.createdAt)}
            </p>
          </div>
        </div>
      </div>

      {/* Status badge */}
      <div className="mb-2">
        <ParsingStatus material={currentMaterial} />
      </div>

      {/* Category and Tags */}
      {isEditing ? (
        <div className="space-y-2 mb-3">
          <div>
            <label className="block text-xs font-medium mb-1 text-foreground">Category</label>
            <CategorySelector
              value={category}
              onChange={setCategory}
              suggestions={categorySuggestions}
              disabled={isSaving}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1 text-foreground">Tags</label>
            <TagInput
              tags={tags}
              onChange={setTags}
              suggestions={tagSuggestions}
              disabled={isSaving}
            />
          </div>
          {saveError && (
            <p className="text-xs text-destructive" role="alert">
              {saveError}
            </p>
          )}
        </div>
      ) : (
        <div className="mb-3 space-y-1">
          {material.category && (
            <p className="text-xs text-muted-foreground">
              <span className="font-medium">Category:</span> {material.category}
            </p>
          )}
          {material.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {material.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 bg-primary/10 text-primary rounded text-xs"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-1.5 pt-2 border-t border-border">
        {isEditing ? (
          <>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || !title.trim()}
              className="px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50"
            >
              {isSaving ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={handleCancelEdit}
              disabled={isSaving}
              className="px-3 py-1.5 text-xs font-medium border border-border text-foreground rounded hover:bg-accent"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="px-3 py-1.5 text-xs font-medium border border-border text-foreground rounded hover:bg-accent"
              title="Edit"
            >
              Edit
            </button>
            {currentMaterial.parsingStatus !== 'completed' && (
              <button
                type="button"
                onClick={handleParse}
                disabled={isParsing || currentMaterial.parsingStatus === 'processing'}
                className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                title="Parse material"
              >
                {isParsing || currentMaterial.parsingStatus === 'processing' ? 'Parsing…' : 'Parse'}
              </button>
            )}
            <button
              type="button"
              onClick={() => onGenerateQuiz(currentMaterial.id)}
              disabled={currentMaterial.parsingStatus !== 'completed'}
              className="px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
              title={currentMaterial.parsingStatus !== 'completed' ? 'Parse the file first' : 'Generate quiz'}
            >
              Quiz
            </button>
            <button
              type="button"
              onClick={() => onDelete(currentMaterial.id)}
              className="px-3 py-1.5 text-xs font-medium text-destructive border border-destructive/30 rounded hover:bg-destructive hover:text-destructive-foreground ml-auto"
              title="Delete"
            >
              Delete
            </button>
          </>
        )}
      </div>
    </article>
  )
}

export default memo(MaterialCard)
