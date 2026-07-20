'use client'

import { useState, useCallback } from 'react'
import { validateMaterialFile, MAX_FILE_SIZE } from '@/lib/materials/file-validation'
import { fetchWithAuth } from '@/lib/api/fetch-with-auth'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth/session'
import { useMetadataSuggestions } from '@/lib/hooks/useMetadataSuggestions'
import TagInput from './TagInput'
import CategorySelector from './CategorySelector'
import { Button } from '@/components/ui/Button'

interface MaterialUploaderProps {
  onUploadComplete?: (materialId: string) => void
  onUploadError?: (error: Error) => void
}

export default function MaterialUploader({
  onUploadComplete,
  onUploadError,
}: MaterialUploaderProps) {
  const { user, session } = useAuth()
  const { tagSuggestions, categorySuggestions } = useMetadataSuggestions(
    Boolean(user)
  )
  const [mode, setMode] = useState<'file' | 'link'>('file')
  const [sourceUrl, setSourceUrl] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState('')

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const acceptFile = useCallback((f: File) => {
    const validation = validateMaterialFile(f)
    if (!validation.valid) {
      setError(validation.error || 'Invalid file')
      return
    }
    setFile(f)
    setTitle(f.name.replace(/\.[^/.]+$/, '')) // title tracks filename
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    setError('')
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) acceptFile(droppedFile)
  }, [acceptFile])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError('')
    const selectedFile = e.target.files?.[0]
    if (selectedFile) acceptFile(selectedFile)
  }
  
  const handleUpload = async () => {
    if (!file || !user || !session) {
      setError('Please select a file')
      return
    }
  
    setError('')
    setIsUploading(true)
    setUploadProgress(0)
  
    try {
      setUploadProgress(10)

      // The file goes browser → Supabase Storage directly. Routing bytes through the
      // API instead would hit Vercel's 4.5MB request body cap at the edge.
      const urlResponse = await fetchWithAuth(session, '/api/materials/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name, fileSize: file.size }),
      })

      if (!urlResponse.ok) {
        const data = await urlResponse.json().catch(() => ({}))
        throw new Error(data.error || 'Could not start upload')
      }

      const { materialId, filePath, token, bucket } = await urlResponse.json()
      setUploadProgress(25)

      const { error: storageError } = await supabase.storage
        .from(bucket)
        .uploadToSignedUrl(filePath, token, file)

      if (storageError) {
        throw new Error(`Upload failed: ${storageError.message}`)
      }

      setUploadProgress(75)

      // Only now does the material row exist — a failure above leaves no broken row.
      const response = await fetchWithAuth(session, '/api/materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          materialId,
          fileName: file.name,
          title: title || file.name.replace(/\.[^/.]+$/, ''),
          category: category || undefined,
          tags: tags.length > 0 ? tags : undefined,
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Upload failed')
      }

      const { material } = await response.json()
      setUploadProgress(100)

      // Auto-parse after upload
      try {
        await fetch('/api/materials/parse', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ materialId: material.id }),
        })
      } catch {
        // Parse can be triggered manually later
      }
  
      setFile(null)
      setTitle('')
      setCategory('')
      setTags([])
      setUploadProgress(0)
  
      if (onUploadComplete) {
        onUploadComplete(material.id)
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Upload failed')
      setError(error.message)
      if (onUploadError) {
        onUploadError(error)
      }
    } finally {
      setIsUploading(false)
    }
  }

  const handleLinkSubmit = async () => {
    if (!user || !session) return

    const url = sourceUrl.trim()
    if (!url) {
      setError('Please paste a URL')
      return
    }
    try {
      new URL(url)
    } catch {
      setError('That does not look like a valid URL')
      return
    }

    setError('')
    setIsUploading(true)
    setUploadProgress(20)

    try {
      const response = await fetchWithAuth(session, '/api/materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceUrl: url,
          title: title.trim() || undefined,
          category: category || undefined,
          tags: tags.length > 0 ? tags : undefined,
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to add link')
      }

      const { material } = await response.json()
      setUploadProgress(75)

      // Fetch transcript / page content
      try {
        await fetch('/api/materials/parse', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ materialId: material.id }),
        })
      } catch {
        // Parse can be retried manually later
      }

      setSourceUrl('')
      setTitle('')
      setCategory('')
      setTags([])
      setUploadProgress(0)

      if (onUploadComplete) onUploadComplete(material.id)
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to add link')
      setError(error.message)
      if (onUploadError) onUploadError(error)
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4">
      {/* Source mode toggle */}
      {!isUploading && (
        <div className="flex gap-2 rounded-lg bg-secondary p-1">
          {(['file', 'link'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m)
                setError('')
              }}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition ${
                mode === m
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {m === 'file' ? 'Upload file' : 'From link'}
            </button>
          ))}
        </div>
      )}

      {/* Drag and Drop Area */}
      {mode === 'file' && (
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-8 text-center transition ${
          isDragging
            ? 'border-primary bg-primary/10'
            : 'border-border hover:border-muted-foreground'
        }`}
      >
        {!file ? (
          <>
            <div className="mb-4">
              <svg
                className="mx-auto h-12 w-12 text-muted-foreground"
                stroke="currentColor"
                fill="none"
                viewBox="0 0 48 48"
              >
                <path
                  d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <p className="text-lg mb-2">
              Drag and drop your file here, or{' '}
              <label className="text-primary hover:underline cursor-pointer">
                browse
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,.txt,.md,.pptx,.png,.jpg,.jpeg"
                  onChange={handleFileSelect}
                  disabled={isUploading}
                />
              </label>
            </p>
            <p className="text-sm text-muted-foreground">
              Supported formats: PDF, TXT, MD, PPTX, PNG, JPG, JPEG (max{' '}
              {MAX_FILE_SIZE / 1024 / 1024}MB)
            </p>
          </>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center space-x-3 min-w-0 flex-1">
              <div className="flex-shrink-0">
                <svg
                  className="h-10 w-10 text-primary"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="text-left min-w-0 flex-1">
                <p className="font-medium truncate">{file.name}</p>
                <p className="text-sm text-muted-foreground">
                  {(file.size / 1024).toFixed(2)} KB
                </p>
              </div>
            </div>
            {!isUploading && (
              <button
                onClick={() => setFile(null)}
                className="text-red-600 hover:text-red-700 flex-shrink-0"
              >
                Remove
              </button>
            )}
          </div>
        )}
      </div>
      )}

      {/* Link input */}
      {mode === 'link' && !isUploading && (
        <div>
          <label className="block text-sm font-medium mb-1">
            YouTube or web page URL
          </label>
          <input
            type="url"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-background text-foreground placeholder:text-muted-foreground"
            placeholder="https://www.youtube.com/watch?v=... or https://example.com/article"
          />
          <p className="mt-1 text-sm text-muted-foreground">
            We&apos;ll pull the transcript (YouTube) or article text (web page).
          </p>
        </div>
      )}

      {/* Upload Progress */}
      {isUploading && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Uploading...</span>
            <span>{uploadProgress}%</span>
          </div>
          <div className="w-full bg-secondary rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Metadata Form */}
      {((mode === 'file' && file) || (mode === 'link' && sourceUrl.trim())) &&
        !isUploading && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-background text-foreground placeholder:text-muted-foreground"
              placeholder="Enter material title"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Category (optional)
            </label>
            <CategorySelector
              value={category}
              onChange={setCategory}
              suggestions={categorySuggestions}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Tags (optional)
            </label>
            <TagInput
              tags={tags}
              onChange={setTags}
              suggestions={tagSuggestions}
            />
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-sm">
          {error}
        </div>
      )}

      {/* Upload Button */}
      {mode === 'file' && file && !isUploading && (
        <Button onClick={handleUpload} disabled={!title.trim()} size="lg" className="w-full">
          Upload Material
        </Button>
      )}
      {mode === 'link' && !isUploading && (
        <Button
          onClick={handleLinkSubmit}
          disabled={!sourceUrl.trim()}
          size="lg"
          className="w-full"
        >
          Add Link
        </Button>
      )}
    </div>
  )
}
