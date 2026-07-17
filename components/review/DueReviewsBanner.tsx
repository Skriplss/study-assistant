'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth/session'
import { fetchWithAuth } from '@/lib/api/fetch-with-auth'

/**
 * Nudge toward the review backlog. Renders nothing when there's nothing due —
 * which is the normal case, so it must not take up space or flash on load.
 */
export default function DueReviewsBanner() {
  const { session } = useAuth()
  const [dueCount, setDueCount] = useState(0)

  useEffect(() => {
    if (!session) return

    let cancelled = false

    const load = async () => {
      try {
        // limit=1 keeps the payload tiny; dueCount is the whole backlog anyway.
        const response = await fetchWithAuth(session, '/api/review/due?limit=1')
        if (!response.ok || cancelled) return
        const data = await response.json()
        if (!cancelled) setDueCount(data.dueCount ?? 0)
      } catch {
        // Silent: this is a nudge, not a feature the page depends on.
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [session])

  if (dueCount === 0) return null

  return (
    <Link
      href="/review"
      className="flex items-center justify-between gap-4 rounded-xl border-2 border-primary/30 bg-primary/5 p-5 transition-colors hover:bg-primary/10"
    >
      <div>
        <p className="font-semibold text-foreground">
          {dueCount} {dueCount === 1 ? 'question is' : 'questions are'} due for review
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Catch them before you forget them.
        </p>
      </div>
      <span className="shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
        Review
      </span>
    </Link>
  )
}
