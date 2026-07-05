'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/session'
import { Spinner } from '@/components/ui/Spinner'

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { user, session, loading } = useAuth()
  const lastSyncedToken = useRef<string | null>(null)

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/auth/login')
    }
  }, [loading, user, router])

  useEffect(() => {
    // Only re-sync the cookie when the access token actually changes — the
    // session object identity churns on every refresh/subscription event.
    if (!session || session.access_token === lastSyncedToken.current) return
    lastSyncedToken.current = session.access_token

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
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <Spinner size="md" className="text-primary" />
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return <>{children}</>
}
