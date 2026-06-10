'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth/session'
import { fetchWithAuth } from '@/lib/api/fetch-with-auth'
import type { StudyMaterial } from '@/lib/types'
import MaterialCard from './MaterialCard'

type FilterStatus = 'all' | 'completed' | 'pending' | 'failed'
type FilterFileType = 'all' | 'pdf' | 'txt' | 'pptx' | 'image'
type GroupBy = 'none' | 'category' | 'fileType' | 'date'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export default function MaterialsListWithChat() {
  const { session } = useAuth()
  const [materials, setMaterials] = useState<StudyMaterial[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Filter states
  const [searchQuery, setSearchQuery] = useState('')
  const [groupBy, setGroupBy] = useState<GroupBy>('none')
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all')
  const [fileTypeFilter, setFileTypeFilter] = useState<FilterFileType>('all')

  // Chat states
  const [selectedMaterial, setSelectedMaterial] = useState<StudyMaterial | null>(null)
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)

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
      if (selectedMaterial?.id === id) {
        setSelectedMaterial(null)
        setChatHistory([])
      }
    } catch {
      setError('Failed to delete material')
    }
  }

  const handleGenerateQuiz = (materialId: string) => {
    window.location.href = `/quizzes/generate?materialId=${materialId}`
  }

  // Apply filters
  const getFilteredMaterials = () => {
    return materials.filter((m) => {
      // Search filter
      if (searchQuery && !m.title.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false
      }

      // Status filter
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

      // File type filter
      if (fileTypeFilter !== 'all') {
        if (fileTypeFilter === 'image') {
          if (!['png', 'jpg', 'jpeg'].includes(m.fileType)) return false
        } else if (m.fileType !== fileTypeFilter) {
          return false
        }
      }

      return true
    })
  }

  // Group materials
  const getGroupedMaterials = () => {
    const filtered = getFilteredMaterials()

    if (groupBy === 'none') {
      return { Ungrouped: filtered }
    }

    const groups: Record<string, StudyMaterial[]> = {}

    filtered.forEach((m) => {
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
  }

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

  // Chat handlers
  const handleSelectMaterial = (material: StudyMaterial) => {
    setSelectedMaterial(material)
    setChatHistory([])
    setChatInput('')
  }

  const handleSendMessage = async () => {
    if (!chatInput.trim() || !selectedMaterial || !session) return

    const userMessage = chatInput.trim()
    setChatInput('')
    setChatLoading(true)

    // Add user message to history
    const newHistory: ChatMessage[] = [
      ...chatHistory,
      { role: 'user', content: userMessage },
    ]
    setChatHistory(newHistory)

    try {
      const response = await fetchWithAuth(
        session,
        `/api/materials/${selectedMaterial.id}/chat`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: userMessage,
            history: chatHistory.slice(-10),
          }),
        }
      )

      const data = await response.json()

      if (!response.ok) {
        setChatHistory([
          ...newHistory,
          {
            role: 'assistant',
            content: `Error: ${data.error || 'Failed to get response'}`,
          },
        ])
        return
      }

      setChatHistory([
        ...newHistory,
        { role: 'assistant', content: data.message },
      ])
    } catch {
      setChatHistory([
        ...newHistory,
        { role: 'assistant', content: 'Error: Failed to send message' },
      ])
    } finally {
      setChatLoading(false)
    }
  }

  const groupedMaterials = getGroupedMaterials()
  const activeFilters = getActiveFilters()

  return (
    <div className="flex overflow-hidden bg-background" style={{ height: 'calc(100vh - 64px - 80px)' }}>
      {/* Left Panel - Filters */}
      <div className="w-[220px] border-r border-border bg-card p-4 overflow-y-auto flex-shrink-0">
        <h2 className="text-lg font-bold mb-4">Filter & Group</h2>

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
            {(['all', 'pdf', 'txt', 'pptx', 'image'] as FilterFileType[]).map((type) => (
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
      <div className="flex-1 overflow-y-auto p-6">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
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

          {loading ? (
            <p className="text-center text-gray-500 py-12">Loading materials…</p>
          ) : Object.keys(groupedMaterials).length === 0 ? (
            <div className="text-center py-16 border border-dashed border-gray-300 rounded-lg">
              <p className="text-gray-600 mb-4">No materials found.</p>
              <Link
                href="/materials/upload"
                className="text-blue-600 hover:underline font-medium"
              >
                Upload your first file
              </Link>
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
                  <div className="space-y-4">
                    {groupMaterials.map((material) => (
                      <div
                        key={material.id}
                        className={`relative ${
                          selectedMaterial?.id === material.id ? 'ring-2 ring-primary rounded-xl' : ''
                        }`}
                      >
                        <MaterialCard
                          material={material}
                          onDelete={handleDelete}
                          onEdit={(updated) =>
                            setMaterials((prev) =>
                              prev.map((m) => (m.id === updated.id ? updated : m))
                            )
                          }
                          onGenerateQuiz={handleGenerateQuiz}
                        />
                        {material.parsingStatus === 'completed' && (
                          <button
                            onClick={() => handleSelectMaterial(material)}
                            className="absolute top-4 right-4 px-3 py-1 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center gap-1"
                          >
                            Chat →
                          </button>
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

      {/* Right Panel - Chat */}
      <div className="w-[360px] border-l border-border bg-card flex flex-col flex-shrink-0">
        {!selectedMaterial ? (
          <div className="flex-1 flex items-center justify-center p-6 text-center">
            <p className="text-muted-foreground">
              Select a material to chat with it
            </p>
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-border">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm truncate" key={selectedMaterial.id}>
                    {selectedMaterial.title}
                  </h3>
                  <span className="inline-block mt-1 px-2 py-0.5 text-xs bg-secondary rounded">
                    {selectedMaterial.fileType.toUpperCase()}
                  </span>
                </div>
                <button
                  onClick={() => {
                    setSelectedMaterial(null)
                    setChatHistory([])
                  }}
                  className="ml-2 text-muted-foreground hover:text-foreground text-xl"
                >
                  ×
                </button>
              </div>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {chatHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center mt-8">
                  Ask questions about this material
                </p>
              ) : (
                chatHistory.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] px-3 py-2 rounded-lg text-sm break-words overflow-wrap-anywhere ${
                        msg.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-secondary text-secondary-foreground'
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))
              )}
              {chatLoading && (
                <div className="flex justify-start">
                  <div className="bg-secondary px-3 py-2 rounded-lg text-sm">
                    <span className="inline-block animate-pulse">Thinking...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Chat Input */}
            <div className="p-4 border-t border-border">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSendMessage()
                    }
                  }}
                  placeholder="Ask a question..."
                  disabled={chatLoading}
                  className="flex-1 px-3 py-2 text-sm border border-border rounded-md bg-background disabled:opacity-50"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={chatLoading || !chatInput.trim()}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                >
                  Send
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
