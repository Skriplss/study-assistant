'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import { Spinner } from '@/components/ui/Spinner'

/**
 * OAuth landing page. The browser Supabase client (PKCE) exchanges the
 * `?code=` from the URL for a session on load; we wait for that session,
 * sync the proxy cookies, then hand off to the dashboard with a full
 * navigation so proxy.ts sees the fresh cookie.
 */
export default function AuthCallbackPage() {
  const [error, setError] = useState('')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const providerError = params.get('error_description') || params.get('error')
    if (providerError) {
      setError(providerError)
      return
    }

    let done = false
    const finish = async (session: { access_token: string; refresh_token: string; expires_in?: number } | null) => {
      if (done || !session) return
      done = true

      await fetch('/api/auth/sync-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          expires_in: session.expires_in,
        }),
      }).catch(() => {
        // Best-effort: AuthGuard re-syncs on the next session event.
      })

      window.location.replace('/dashboard')
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void finish(session)
    })
    supabase.auth.getSession().then(({ data }) => finish(data.session))

    const timeout = setTimeout(() => {
      if (!done) setError('Could not complete sign-in. Please try again.')
    }, 10000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [])

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      {error ? (
        <div className="w-full max-w-md space-y-4 text-center">
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm font-medium text-destructive">
            {error}
          </div>
          <Link href="/auth/login" className="text-sm font-medium text-primary hover:underline">
            Back to login
          </Link>
        </div>
      ) : (
        <div className="text-center">
          <Spinner size="md" className="text-primary" />
          <p className="mt-4 text-muted-foreground">Signing you in...</p>
        </div>
      )}
    </div>
  )
}
