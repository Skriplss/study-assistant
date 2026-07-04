'use client'

import { useState } from 'react'
import type { SearchResult } from '@/lib/types'
import { useAuth } from '@/lib/auth/session'
import { fetchWithAuth } from '@/lib/api/fetch-with-auth'

interface SearchBarProps {
  onResults: (results: SearchResult[]) => void
}

export function SearchBar({ onResults }: SearchBarProps) {
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const { session } = useAuth()

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim() || !session) return

    setSearching(true)
    try {
      const res = await fetchWithAuth(
        session,
        `/api/materials/search?q=${encodeURIComponent(query)}`
      )
      if (res.ok) {
        const results = await res.json()
        onResults(results)
      }
    } catch (err) {
      console.error('Search failed:', err)
    } finally {
      setSearching(false)
    }
  }

  return (
    <form onSubmit={handleSearch} className="w-full">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search materials..."
          className="border-black-300 w-full rounded-lg border px-4 py-3 pl-12 focus:border-blue-500 focus:outline-none"
        />
        <svg
          className="text-black-400 absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        {searching && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          </div>
        )}
      </div>
    </form>
  )
}
