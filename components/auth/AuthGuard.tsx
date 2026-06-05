'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/session'

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { user, session, loading } = useAuth()

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/auth/login')
    }
  }, [loading, user, router])

  useEffect(() => {
    if (!session) return

    fetch('/api/auth/sync-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_in: session.expires_in,
      }),
    }).catch(() => {
      // Cookie sync is best-effort for middleware-protected navigation
    })
  }, [session])

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-gray-500">
        Loading…
      </div>
    )
  }

  if (!user) {
    return null
  }

  return <>{children}</>
}
