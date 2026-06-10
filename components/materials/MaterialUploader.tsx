'use client'

import { useState, useCallback } from 'react'
import { validateMaterialFile } from '@/lib/materials/file-validation'
import { fetchWithAuth } from '@/lib/api/fetch-with-auth'
import { useAuth } from '@/lib/auth/session'
import { useMetadataSuggestions } from '@/lib/hooks/useMetadataSuggestions'
import TagInput from './TagInput'
import CategorySelector from './CategorySelector'

interface MaterialUploaderProps {
  onUploadComplete?: (materialId: string) => void
  onUploadError?: (error: Error) => void
  maxFileSize?: number
}

export default function MaterialUploader({
  onUploadComplete,
  onUploadError,
  maxFileSize = 50 * 1024 * 1024,
}: MaterialUploaderProps) {
  const { user, session } = useAuth()
  const { tagSuggestions, categorySuggestions } = useMetadataSuggestions(
    Boolean(user)
  )
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

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    setError('')

    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) {
      const validation = validateMaterialFile(droppedFile)
      if (!validation.valid) {
        setError(validation.error || 'Invalid file')
        return
      }
      setFile(droppedFile)
      // Always update title from filename
      setTitle(droppedFile.name.replace(/\.[^/.]+$/, ''))
    }
  }, [])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError('')
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      const validation = validateMaterialFile(selectedFile) // ✅ уже импортирован
      if (!validation.valid) {
        setError(validation.error || 'Invalid file')
        return
      }
      setFile(selectedFile)
      // Always update title from filename
      setTitle(selectedFile.name.replace(/\.[^/.]+$/, ''))
    }
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
  
      const formData = new FormData()
      formData.append('file', file)
      formData.append('title', title || file.name.replace(/\.[^/.]+$/, ''))
      if (category) formData.append('category', category)
      if (tags.length > 0) formData.append('tags', tags.join(','))
  
      const response = await fetchWithAuth(session, '/api/materials', {
        method: 'POST',
        body: formData,
      })
  
      setUploadProgress(75)
  
      if (!response.ok) {
        // Check if response is JSON
        const contentType = response.headers.get('content-type')
        if (contentType && contentType.includes('application/json')) {
          const data = await response.json()
          throw new Error(data.error || 'Upload failed')
        } else {
          // Server returned non-JSON (probably HTML error page)
          const text = await response.text()
          console.error('Server error:', text)
          throw new Error('Server error. Please check console for details.')
        }
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

  const handleRetry = () => {
  setError('')
  handleUpload()
}

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4">
      {/* Drag and Drop Area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-8 text-center transition ${
          isDragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        {!file ? (
          <>
            <div className="mb-4">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
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
              <label className="text-blue-600 hover:underline cursor-pointer">
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
            <p className="text-sm text-gray-500">
              Supported formats: PDF, TXT, MD, PPTX, PNG, JPG, JPEG (max {maxFileSize / 1024 / 1024}
              MB)
            </p>
          </>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center space-x-3 min-w-0 flex-1">
              <div className="flex-shrink-0">
                <svg
                  className="h-10 w-10 text-blue-500"
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
                <p className="text-sm text-gray-500">
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

      {/* Upload Progress */}
      {isUploading && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Uploading...</span>
            <span>{uploadProgress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Metadata Form */}
      {file && !isUploading && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-background text-foreground"
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
        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm flex justify-between items-center">
          <span>{error}</span>
          {isUploading && (
            <button
              onClick={handleRetry}
              className="text-red-800 underline hover:no-underline"
            >
              Retry
            </button>
          )}
        </div>
      )}

      {/* Upload Button */}
      {file && !isUploading && (
        <button
          onClick={handleUpload}
          disabled={!title.trim()}
          className="w-full py-3 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
        >
          Upload Material
        </button>
      )}
    </div>
  )
}
