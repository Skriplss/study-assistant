'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import { Spinner } from '@/components/ui/Spinner'
import NewPasswordForm from '@/components/auth/NewPasswordForm'

/**
 * Landing page for the recovery link emailed by /api/auth/reset-password.
 * Supabase hands the recovery session over in the URL — hash tokens for the
 * implicit link our admin client generates, `?code=` under PKCE — and the
 * browser client consumes either via detectSessionInUrl. So we just wait for
 * the session to land before letting the user pick a new password.
 */
export default function ResetPasswordConfirmPage() {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const query = new URLSearchParams(window.location.search)
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const linkError =
      query.get('error_description') ||
      query.get('error') ||
      hash.get('error_description') ||
      hash.get('error')
    if (linkError) {
      setError(linkError)
      return
    }

    let done = false
    const finish = (session: unknown) => {
      if (done || !session) return
      done = true
      setReady(true)
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => finish(session))
    supabase.auth.getSession().then(({ data }) => finish(data.session))

    const timeout = setTimeout(() => {
      if (!done) {
        setError('This reset link is invalid or has expired. Request a new one.')
      }
    }, 10000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="bg-card p-8 rounded-lg border border-border">
          {error ? (
            <div className="space-y-4 text-center">
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm font-medium text-destructive">
                {error}
              </div>
              <Link
                href="/auth/reset-password"
                className="text-sm font-medium text-primary hover:underline"
              >
                Request a new link
              </Link>
            </div>
          ) : ready ? (
            <NewPasswordForm />
          ) : (
            <div className="text-center py-8">
              <Spinner size="md" className="text-primary" />
              <p className="mt-4 text-muted-foreground">Verifying your link...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
