'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { fetchWithAuth } from '@/lib/api/fetch-with-auth'
import { Button } from '@/components/ui/Button'
import {
  validatePassword,
  getPasswordStrength,
} from '@/lib/auth/password-validation'

/**
 * Sets a new password on the recovery session established by the emailed link.
 * Rendered only once the confirm page has a session in hand.
 */
export default function NewPasswordForm() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const passwordValidation = validatePassword(password)
  const passwordStrength = password ? getPasswordStrength(password) : null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (!passwordValidation.isValid) {
      setError(passwordValidation.errors[0])
      return
    }

    setIsLoading(true)

    try {
      // Goes through our own route rather than supabase.auth.updateUser: the
      // rules above are a UI affordance, and the server has to be the one that
      // actually enforces them.
      const { data } = await supabase.auth.getSession()
      if (!data.session) {
        setError('Your reset link has expired. Request a new one.')
        return
      }

      const res = await fetchWithAuth(
        data.session,
        '/api/auth/change-password',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password }),
        }
      )

      if (!res.ok) {
        const payload = await res.json().catch(() => null)
        setError(payload?.error ?? 'Could not update the password')
        return
      }

      // The session survives the change, so sync the proxy cookies from it and
      // hard-navigate so proxy.ts sees them.
      await fetch('/api/auth/sync-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          expires_in: data.session.expires_in,
        }),
      }).catch(() => {
        // Best-effort: AuthGuard re-syncs on the next session event.
      })

      window.location.replace('/dashboard')
    } catch (err) {
      setError('An unexpected error occurred')
      console.error('Set password error:', err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md space-y-5">
      <div className="mb-6 text-center">
        <h2 className="mb-2 text-2xl font-semibold">Choose a new password</h2>
        <p className="text-sm text-muted-foreground">
          Pick something you haven&apos;t used here before.
        </p>
      </div>

      <div>
        <label
          htmlFor="password"
          className="mb-2 block text-sm font-semibold text-foreground"
        >
          New password
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoFocus
          className="w-full rounded-lg border border-border bg-background px-4 py-3 text-foreground transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder="••••••••"
          disabled={isLoading}
        />
        {password && (
          <div className="mt-3">
            <div className="flex items-center gap-2">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                <div
                  className={`h-full transition-all ${
                    passwordStrength === 'weak'
                      ? 'w-1/3 bg-red-500'
                      : passwordStrength === 'medium'
                        ? 'w-2/3 bg-yellow-500'
                        : 'w-full bg-green-500'
                  }`}
                />
              </div>
              <span className="text-xs font-semibold capitalize text-muted-foreground">
                {passwordStrength}
              </span>
            </div>
          </div>
        )}
        <div className="mt-3 space-y-1.5 rounded-lg bg-secondary/50 p-3 text-xs text-muted-foreground">
          <p className="font-semibold text-foreground">
            Password must contain:
          </p>
          <ul className="list-inside list-disc space-y-1">
            <li
              className={
                password.length >= 8
                  ? 'font-medium text-green-600 dark:text-green-400'
                  : ''
              }
            >
              At least 8 characters
            </li>
            <li
              className={
                /[a-z]/.test(password)
                  ? 'font-medium text-green-600 dark:text-green-400'
                  : ''
              }
            >
              One lowercase letter
            </li>
            <li
              className={
                /[A-Z]/.test(password)
                  ? 'font-medium text-green-600 dark:text-green-400'
                  : ''
              }
            >
              One uppercase letter
            </li>
            <li
              className={
                /\d/.test(password)
                  ? 'font-medium text-green-600 dark:text-green-400'
                  : ''
              }
            >
              One number
            </li>
          </ul>
        </div>
      </div>

      <div>
        <label
          htmlFor="confirmPassword"
          className="mb-2 block text-sm font-semibold text-foreground"
        >
          Confirm new password
        </label>
        <input
          id="confirmPassword"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          className="w-full rounded-lg border border-border bg-background px-4 py-3 text-foreground transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder="••••••••"
          disabled={isLoading}
        />
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm font-medium text-destructive">
          {error}
        </div>
      )}

      <Button
        type="submit"
        disabled={isLoading || !passwordValidation.isValid}
        loading={isLoading}
        className="w-full"
      >
        {isLoading ? 'Saving...' : 'Save password'}
      </Button>
    </form>
  )
}
