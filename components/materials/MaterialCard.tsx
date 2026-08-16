'use client'

import { memo, useEffect, useState } from 'react'
import type { StudyMaterial } from '@/lib/types'
import { useAuth } from '@/lib/auth/session'
import { fetchWithAuth } from '@/lib/api/fetch-with-auth'
import { useToast } from '@/components/ui/Toast'
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
  youtube: 'YouTube',
  url: 'Web',
}

function MaterialCard({
  material,
  onDelete,
  onEdit,
  onGenerateQuiz,
}: MaterialCardProps) {
  const { session } = useAuth()
  const { toast } = useToast()
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
    setCurrentMaterial(material)
    // Not while the user is typing. This used to resync unconditionally, so any
    // refresh of the list (someone finishing an upload, a parse completing) threw
    // away an open edit — and left the Save button sitting there, ready to write
    // the old values back.
    if (isEditing) return
    setTitle(material.title)
    setCategory(material.category ?? '')
    setTags(material.tags)
  }, [material, isEditing])

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
        const updated = {
          ...currentMaterial,
          parsingStatus: 'completed' as const,
        }
        setCurrentMaterial(updated)
        onEdit?.(updated)
      } else {
        // Was console.error only: the button went back to "Parse" and nothing
        // else happened, so the user just kept clicking it.
        const err = await response.json().catch(() => ({}))
        toast({
          message: err.details || err.error || 'Parsing failed',
          variant: 'error',
        })
      }
    } catch {
      toast({ message: 'Parsing failed', variant: 'error' })
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
    <article className="rounded-lg border border-border bg-card p-4 transition-shadow hover:shadow-md">
      {/* Header with title and file type */}
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-2">
          <span className="inline-block flex-shrink-0 rounded bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground">
            {FILE_TYPE_LABELS[currentMaterial.fileType]}
          </span>

          <div className="min-w-0 flex-1">
            {isEditing ? (
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded border border-border bg-background px-2 py-1 text-sm font-medium text-foreground"
              />
            ) : (
              <h3 className="truncate text-sm font-semibold text-foreground">
                {currentMaterial.title}
              </h3>
            )}
            <p className="mt-0.5 text-xs text-muted-foreground">
              {formatFileSize(currentMaterial.fileSize)} ·{' '}
              {formatDate(currentMaterial.createdAt)}
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
        <div className="mb-3 space-y-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">
              Category
            </label>
            <CategorySelector
              value={category}
              onChange={setCategory}
              suggestions={categorySuggestions}
              disabled={isSaving}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">
              Tags
            </label>
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
                  className="rounded bg-primary/10 px-2 py-0.5 text-xs text-primary"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-1.5 border-t border-border pt-2">
        {isEditing ? (
          <>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || !title.trim()}
              className="rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {isSaving ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={handleCancelEdit}
              disabled={isSaving}
              className="rounded border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="rounded border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
              title="Edit"
            >
              Edit
            </button>
            {currentMaterial.parsingStatus !== 'completed' && (
              <button
                type="button"
                onClick={handleParse}
                disabled={
                  isParsing || currentMaterial.parsingStatus === 'processing'
                }
                className="rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                title="Parse material"
              >
                {isParsing || currentMaterial.parsingStatus === 'processing'
                  ? 'Parsing…'
                  : 'Parse'}
              </button>
            )}
            <button
              type="button"
              onClick={() => onGenerateQuiz(currentMaterial.id)}
              disabled={currentMaterial.parsingStatus !== 'completed'}
              className="rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              title={
                currentMaterial.parsingStatus !== 'completed'
                  ? 'Parse the file first'
                  : 'Generate quiz'
              }
            >
              Quiz
            </button>
            <button
              type="button"
              onClick={() => onDelete(currentMaterial.id)}
              className="ml-auto rounded border border-destructive/30 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive hover:text-destructive-foreground"
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
