'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase/client'
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
      const { error: updateError } = await supabase.auth.updateUser({ password })

      if (updateError) {
        setError(updateError.message)
        return
      }

      // updateUser returns the user, not the session — read it back for the
      // proxy cookies, then hard-navigate so proxy.ts sees them.
      const { data } = await supabase.auth.getSession()
      if (data.session) {
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
      }

      window.location.replace('/dashboard')
    } catch (err) {
      setError('An unexpected error occurred')
      console.error('Set password error:', err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 w-full max-w-md">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-semibold mb-2">Choose a new password</h2>
        <p className="text-muted-foreground text-sm">
          Pick something you haven&apos;t used here before.
        </p>
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-semibold mb-2 text-foreground">
          New password
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoFocus
          className="w-full px-4 py-3 border border-border bg-background text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all"
          placeholder="••••••••"
          disabled={isLoading}
        />
        {password && (
          <div className="mt-3">
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    passwordStrength === 'weak'
                      ? 'bg-red-500 w-1/3'
                      : passwordStrength === 'medium'
                        ? 'bg-yellow-500 w-2/3'
                        : 'bg-green-500 w-full'
                  }`}
                />
              </div>
              <span className="text-xs font-semibold capitalize text-muted-foreground">
                {passwordStrength}
              </span>
            </div>
          </div>
        )}
        <div className="mt-3 text-xs text-muted-foreground space-y-1.5 bg-secondary/50 p-3 rounded-lg">
          <p className="font-semibold text-foreground">Password must contain:</p>
          <ul className="list-disc list-inside space-y-1">
            <li className={password.length >= 8 ? 'text-green-600 dark:text-green-400 font-medium' : ''}>
              At least 8 characters
            </li>
            <li className={/[a-z]/.test(password) ? 'text-green-600 dark:text-green-400 font-medium' : ''}>
              One lowercase letter
            </li>
            <li className={/[A-Z]/.test(password) ? 'text-green-600 dark:text-green-400 font-medium' : ''}>
              One uppercase letter
            </li>
            <li className={/\d/.test(password) ? 'text-green-600 dark:text-green-400 font-medium' : ''}>
              One number
            </li>
          </ul>
        </div>
      </div>

      <div>
        <label
          htmlFor="confirmPassword"
          className="block text-sm font-semibold mb-2 text-foreground"
        >
          Confirm new password
        </label>
        <input
          id="confirmPassword"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          className="w-full px-4 py-3 border border-border bg-background text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all"
          placeholder="••••••••"
          disabled={isLoading}
        />
      </div>

      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive text-sm font-medium">
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
