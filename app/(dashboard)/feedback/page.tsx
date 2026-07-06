'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/session'
import { isAdmin } from '@/lib/config/admin'
import { fetchWithAuth } from '@/lib/api/fetch-with-auth'
import { useToast } from '@/components/ui/Toast'
import { Spinner } from '@/components/ui/Spinner'

interface FeedbackRow {
  id: string
  type: 'bug' | 'idea' | 'other'
  message: string
  page_url: string | null
  status: 'new' | 'seen' | 'resolved'
  created_at: string
}

const TYPE_META: Record<FeedbackRow['type'], { label: string; className: string }> = {
  bug: { label: '🐞 Bug', className: 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200' },
  idea: { label: '💡 Idea', className: 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200' },
  other: { label: '💬 Other', className: 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200' },
}

const STATUSES: FeedbackRow['status'][] = ['new', 'seen', 'resolved']

export default function FeedbackPage() {
  const router = useRouter()
  const { session, user, loading: authLoading } = useAuth()
  const { toast } = useToast()

  const [rows, setRows] = useState<FeedbackRow[]>([])
  const [loading, setLoading] = useState(true)

  const admin = isAdmin(user?.email)

  const load = useCallback(async () => {
    if (!session) return
    try {
      const res = await fetchWithAuth(session, '/api/feedback')
      if (!res.ok) throw new Error('failed')
      const data = await res.json()
      setRows(data.feedback ?? [])
    } catch {
      toast({ message: 'Failed to load feedback', variant: 'error' })
    } finally {
      setLoading(false)
    }
  }, [session, toast])

  useEffect(() => {
    // Bounce non-admins who navigate here directly.
    if (!authLoading && !admin) {
      router.replace('/dashboard')
      return
    }
    if (session && admin) load()
  }, [authLoading, admin, session, load, router])

  const setStatus = async (id: string, status: FeedbackRow['status']) => {
    if (!session) return
    const prev = rows
    setRows((r) => r.map((x) => (x.id === id ? { ...x, status } : x)))
    try {
      const res = await fetchWithAuth(session, '/api/feedback', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      })
      if (!res.ok) throw new Error('failed')
    } catch {
      setRows(prev)
      toast({ message: 'Failed to update status', variant: 'error' })
    }
  }

  if (authLoading || (admin && loading)) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner size="lg" className="text-primary" />
      </div>
    )
  }

  if (!admin) return null

  const newCount = rows.filter((r) => r.status === 'new').length

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">
          Feedback{' '}
          <span className="text-base font-medium text-muted-foreground">
            ({rows.length}{newCount ? `, ${newCount} new` : ''})
          </span>
        </h1>
        <button
          onClick={load}
          className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          Refresh
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="text-muted-foreground py-12 text-center">No reports yet.</p>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <div
              key={r.id}
              className={`rounded-xl border-2 p-4 shadow-sm transition-colors ${
                r.status === 'resolved'
                  ? 'border-border bg-card/50 opacity-70'
                  : 'border-border bg-card'
              }`}
            >
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${TYPE_META[r.type].className}`}>
                  {TYPE_META[r.type].label}
                </span>
                {r.page_url && (
                  <code className="rounded bg-secondary px-1.5 py-0.5 text-xs text-muted-foreground">{r.page_url}</code>
                )}
                <span className="ml-auto text-xs text-muted-foreground">
                  {new Date(r.created_at).toLocaleString()}
                </span>
              </div>

              <p className="whitespace-pre-wrap break-words text-sm text-foreground">{r.message}</p>

              <div className="mt-3 flex gap-1.5">
                {STATUSES.map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatus(r.id, s)}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-all ${
                      r.status === s
                        ? 'bg-primary text-primary-foreground'
                        : 'border border-border bg-card text-muted-foreground hover:border-primary/50'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
