'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth/session'
import { fetchWithAuth } from '@/lib/api/fetch-with-auth'
import type { TagEntry } from '@/lib/tags/tag-management'

export function useMetadataSuggestions(enabled = true) {
  const { session } = useAuth()
  const [tagSuggestions, setTagSuggestions] = useState<TagEntry[]>([])
  const [categorySuggestions, setCategorySuggestions] = useState<string[]>([])

  useEffect(() => {
    if (!enabled || !session) return

    const load = async () => {
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
        // Suggestions are optional
      }
    }

    load()
  }, [enabled, session])

  return { tagSuggestions, categorySuggestions }
}
