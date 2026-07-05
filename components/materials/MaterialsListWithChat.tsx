'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth/session'
import { fetchWithAuth } from '@/lib/api/fetch-with-auth'
import type { StudyMaterial } from '@/lib/types'
import MaterialCard from './MaterialCard'
import MaterialUploader from './MaterialUploader'
import { Modal } from '@/components/ui/Modal'
import { cn } from '@/lib/utils/cn'

type FilterStatus = 'all' | 'completed' | 'pending' | 'failed'
type FilterFileType = 'all' | 'pdf' | 'txt' | 'pptx' | 'image' | 'youtube' | 'url'
type GroupBy = 'none' | 'category' | 'fileType' | 'date'

export default function MaterialsListWithChat() {
  const { session } = useAuth()
  const [materials, setMaterials] = useState<StudyMaterial[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [uploadOpen, setUploadOpen] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)

  // Filter states
  const [searchQuery, setSearchQuery] = useState('')
  const [groupBy, setGroupBy] = useState<GroupBy>('none')
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all')
  const [fileTypeFilter, setFileTypeFilter] = useState<FilterFileType>('all')

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

  const handleDelete = useCallback(
    async (id: string) => {
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
    },
    [session]
  )

  const handleGenerateQuiz = useCallback((materialId: string) => {
    window.location.href = `/quizzes/generate?materialId=${materialId}`
  }, [])

  const handleEditMaterial = useCallback((updated: StudyMaterial) => {
    setMaterials((prev) => prev.map((m) => (m.id === updated.id ? updated : m)))
  }, [])

  const handleUploadComplete = useCallback(() => {
    setUploadOpen(false)
    loadMaterials()
  }, [loadMaterials])

  // Apply filters — recomputed only when materials or a filter changes,
  // not on every keystroke-driven re-render.
  const filteredMaterials = useMemo(() => {
    return materials.filter((m) => {
      if (searchQuery && !m.title.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false
      }

      if (statusFilter !== 'all') {
        const statusMap: Record<FilterStatus, string[]> = {
          all: [],
          completed: ['completed'],
          pending: ['pending', 'processing'],
          failed: ['failed'],
        }
        if (!statusMap[statusFilter].includes(m.parsingStatus)) {
          return false
        }
      }

      if (fileTypeFilter !== 'all') {
        if (fileTypeFilter === 'image') {
          if (!['png', 'jpg', 'jpeg'].includes(m.fileType)) return false
        } else if (m.fileType !== fileTypeFilter) {
          return false
        }
      }

      return true
    })
  }, [materials, searchQuery, statusFilter, fileTypeFilter])

  // Group materials
  const groupedMaterials = useMemo(() => {
    if (groupBy === 'none') {
      return { Ungrouped: filteredMaterials }
    }

    const groups: Record<string, StudyMaterial[]> = {}

    filteredMaterials.forEach((m) => {
      let key = 'Other'

      if (groupBy === 'category') {
        key = m.category || 'Uncategorized'
      } else if (groupBy === 'fileType') {
        key = m.fileType.toUpperCase()
      } else if (groupBy === 'date') {
        const date = new Date(m.createdAt)
        key = date.toLocaleDateString(undefined, { year: 'numeric', month: 'long' })
      }

      if (!groups[key]) groups[key] = []
      groups[key].push(m)
    })

    return groups
  }, [filteredMaterials, groupBy])

  // Get active filters for display
  const getActiveFilters = (): string[] => {
    const filters: string[] = []
    if (statusFilter !== 'all') filters.push(`Status: ${statusFilter}`)
    if (fileTypeFilter !== 'all') filters.push(`Type: ${fileTypeFilter}`)
    if (searchQuery) filters.push(`Search: "${searchQuery}"`)
    return filters
  }

  const clearFilter = (filter: string) => {
    if (filter.startsWith('Status:')) setStatusFilter('all')
    if (filter.startsWith('Type:')) setFileTypeFilter('all')
    if (filter.startsWith('Search:')) setSearchQuery('')
  }

  const activeFilters = getActiveFilters()

  return (
    <div className="flex flex-col md:flex-row md:h-[calc(100vh-144px)] md:overflow-hidden bg-background">
      {/* Mobile filter toggle */}
      <button
        type="button"
        onClick={() => setFiltersOpen((o) => !o)}
        aria-expanded={filtersOpen}
        className="md:hidden flex items-center justify-between border-b border-border bg-card px-4 py-3 text-sm font-medium"
      >
        <span>
          Filter &amp; Group
          {activeFilters.length > 0 && ` (${activeFilters.length})`}
        </span>
        <span className="text-muted-foreground">{filtersOpen ? '▲' : '▼'}</span>
      </button>

      {/* Left Panel - Filters */}
      <div
        className={cn(
          'border-b md:border-b-0 md:border-r border-border bg-card p-4 overflow-y-auto md:w-[220px] md:flex-shrink-0',
          filtersOpen ? 'block' : 'hidden md:block'
        )}
      >
        <h2 className="hidden md:block text-lg font-bold mb-4">Filter & Group</h2>

        {/* Search */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Search</label>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by title..."
            className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background"
          />
        </div>

        {/* Group By */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Group by</label>
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as GroupBy)}
            className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background"
          >
            <option value="none">None</option>
            <option value="category">Category</option>
            <option value="fileType">File Type</option>
            <option value="date">Date</option>
          </select>
        </div>

        {/* Status Filter */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Status</label>
          <div className="space-y-1">
            {(['all', 'completed', 'pending', 'failed'] as FilterStatus[]).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`w-full px-3 py-1.5 text-xs text-left rounded-md transition-colors ${
                  statusFilter === status
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary hover:bg-secondary/80'
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* File Type Filter */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">File Type</label>
          <div className="space-y-1">
            {(['all', 'pdf', 'txt', 'pptx', 'image', 'youtube', 'url'] as FilterFileType[]).map((type) => (
              <button
                key={type}
                onClick={() => setFileTypeFilter(type)}
                className={`w-full px-3 py-1.5 text-xs text-left rounded-md transition-colors ${
                  fileTypeFilter === type
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary hover:bg-secondary/80'
                }`}
              >
                {type.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Active Filters */}
        {activeFilters.length > 0 && (
          <div className="mt-4 pt-4 border-t border-border">
            <label className="block text-sm font-medium mb-2">Active Filters</label>
            <div className="space-y-1">
              {activeFilters.map((filter) => (
                <div
                  key={filter}
                  className="flex items-center justify-between bg-primary/10 px-2 py-1 rounded text-xs"
                >
                  <span className="truncate">{filter}</span>
                  <button
                    onClick={() => clearFilter(filter)}
                    className="ml-1 text-primary hover:text-primary/80"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Center Panel - Materials List */}
      <div className="flex-1 md:overflow-y-auto p-4 sm:p-6">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Study materials</h1>
            <button
              onClick={() => setUploadOpen(true)}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 text-sm font-medium"
            >
              + Upload
            </button>
          </div>

          {error && (
            <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-3">
              {error}
            </p>
          )}

          {loading ? (
            <p className="text-center text-muted-foreground py-12">Loading materials…</p>
          ) : Object.keys(groupedMaterials).length === 0 ? (
            <div className="text-center py-16 border border-dashed border-border rounded-lg">
              <p className="text-muted-foreground mb-4">No materials found.</p>
              <button
                onClick={() => setUploadOpen(true)}
                className="text-primary hover:underline font-medium"
              >
                Upload your first file
              </button>
            </div>
          ) : (
            <div className="space-y-8">
              {Object.entries(groupedMaterials).map(([groupName, groupMaterials]) => (
                <div key={groupName}>
                  {groupBy !== 'none' && (
                    <h2 className="text-lg font-semibold mb-3 text-foreground">
                      {groupName} ({groupMaterials.length})
                    </h2>
                  )}
                  <div className="space-y-3">
                    {groupMaterials.map((material) => (
                      <div key={material.id} className="relative">
                        <MaterialCard
                          material={material}
                          onDelete={handleDelete}
                          onEdit={handleEditMaterial}
                          onGenerateQuiz={handleGenerateQuiz}
                        />
                        {material.parsingStatus === 'completed' && (
                          <Link
                            href={`/chat?material=${material.id}`}
                            className="absolute top-2 right-2 px-2 py-1 text-xs font-medium rounded shadow-sm transition-colors bg-primary text-primary-foreground hover:bg-primary/90"
                          >
                            Chat
                          </Link>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Modal open={uploadOpen} onClose={() => setUploadOpen(false)} title="Upload material">
        <MaterialUploader onUploadComplete={handleUploadComplete} />
      </Modal>
    </div>
  )
}
