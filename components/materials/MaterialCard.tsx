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
  pptx: 'PowerPoint',
  png: 'Image',
  jpg: 'Image',
  jpeg: 'Image',
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
      const response = await fetch('/api/materials/parse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ materialId: currentMaterial.id }),
      })
      if (response.ok) {
        // Reload material from server to get fresh parsingStatus
        const res = await fetch(`/api/materials/${currentMaterial.id}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        if (res.ok) {
          const data = await res.json()
          console.log('Reloaded material:', data.material?.parsingStatus)
          const updated = data.material ?? { ...currentMaterial, parsingStatus: 'completed' as const }
          setCurrentMaterial(updated)
          onEdit?.(updated)
        } else {
          const updated = { ...currentMaterial, parsingStatus: 'completed' as const }
          setCurrentMaterial(updated)
          onEdit?.(updated)
        }
      } else {
        const err = await response.json()
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
    <article className="border border-border rounded-xl p-6 bg-card shadow-lg hover:shadow-xl transition-all duration-300 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2 border-2 border-border bg-background text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary font-semibold transition-all"
            />
          ) : (
            <h3 className="font-bold text-xl text-foreground truncate">{currentMaterial.title}</h3>
          )}
          <p className="text-sm text-muted-foreground mt-2">
            {FILE_TYPE_LABELS[currentMaterial.fileType]} · {formatFileSize(currentMaterial.fileSize)} ·{' '}
            Uploaded {formatDate(currentMaterial.createdAt)}
          </p>
        </div>

        {!isEditing && (
          <span className="px-3 py-1.5 text-xs font-semibold bg-secondary text-secondary-foreground rounded-full">
            {FILE_TYPE_LABELS[currentMaterial.fileType]}
          </span>
        )}
      </div>

      <ParsingStatus material={currentMaterial} />

      {isEditing ? (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-2 text-foreground">Category</label>
            <CategorySelector
              value={category}
              onChange={setCategory}
              suggestions={categorySuggestions}
              disabled={isSaving}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-2 text-foreground">Tags</label>
            <TagInput
              tags={tags}
              onChange={setTags}
              suggestions={tagSuggestions}
              disabled={isSaving}
            />
          </div>
          {saveError && (
            <p className="text-sm text-destructive font-medium" role="alert">
              {saveError}
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {material.category && (
            <p className="text-sm">
              <span className="font-semibold text-foreground">Category:</span>{' '}
              <span className="text-muted-foreground">{material.category}</span>
            </p>
          )}
          {material.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {material.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium border border-primary/20"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-4 border-t border-border">
        {isEditing ? (
          <>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || !title.trim()}
              className="px-4 py-2 text-sm font-semibold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground transition-all shadow-md"
            >
              {isSaving ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={handleCancelEdit}
              disabled={isSaving}
              className="px-4 py-2 text-sm font-medium border-2 border-border text-foreground rounded-lg hover:bg-accent transition-all"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="px-4 py-2 text-sm font-medium border-2 border-border text-foreground rounded-lg hover:bg-accent transition-all"
            >
              Edit
            </button>
            {currentMaterial.parsingStatus !== 'completed' && (
              <button
                type="button"
                onClick={handleParse}
                disabled={isParsing || currentMaterial.parsingStatus === 'processing'}
                className="px-4 py-2 text-sm font-semibold bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-muted disabled:text-muted-foreground transition-all shadow-md"
              >
                {isParsing || currentMaterial.parsingStatus === 'processing' ? 'Parsing…' : 'Parse'}
              </button>
            )}
            <button
              type="button"
              onClick={() => onGenerateQuiz(currentMaterial.id)}
              disabled={currentMaterial.parsingStatus !== 'completed'}
              className="px-4 py-2 text-sm font-semibold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed transition-all shadow-md"
              title={currentMaterial.parsingStatus !== 'completed' ? 'Parse the file first' : ''}
            >
              Generate quiz
            </button>
            <button
              type="button"
              onClick={() => onDelete(currentMaterial.id)}
              className="px-4 py-2 text-sm font-medium text-destructive border-2 border-destructive/30 rounded-lg hover:bg-destructive hover:text-destructive-foreground ml-auto transition-all"
            >
              Delete
            </button>
          </>
        )}
      </div>
    </article>
  )
}
