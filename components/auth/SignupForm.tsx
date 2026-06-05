'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import {
  validatePassword,
  getPasswordStrength,
} from '@/lib/auth/password-validation'

export default function SignupForm() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const passwordValidation = validatePassword(password)
  const passwordStrength = password ? getPasswordStrength(password) : null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validate passwords match
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    // Validate password requirements
    if (!passwordValidation.isValid) {
      setError(passwordValidation.errors[0])
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Signup failed')
        if (data.details) {
          setError(data.details.join(', '))
        }
        return
      }

      // Store session in Supabase client
      if (data.session) {
        await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        })
      }

      // Redirect to dashboard
      router.push('/dashboard')
      router.refresh()
    } catch (err) {
      setError('An unexpected error occurred')
      console.error('Signup error:', err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 w-full max-w-md">
      <div>
        <label htmlFor="name" className="block text-sm font-semibold mb-2 text-foreground">
          Name (optional)
        </label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-4 py-3 border-2 border-border bg-background text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all"
          placeholder="John Doe"
          disabled={isLoading}
        />
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-semibold mb-2 text-foreground">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full px-4 py-3 border-2 border-border bg-background text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all"
          placeholder="your@email.com"
          disabled={isLoading}
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-semibold mb-2 text-foreground">
          Password
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full px-4 py-3 border-2 border-border bg-background text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all"
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
          Confirm Password
        </label>
        <input
          id="confirmPassword"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          className="w-full px-4 py-3 border-2 border-border bg-background text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all"
          placeholder="••••••••"
          disabled={isLoading}
        />
      </div>

      {error && (
        <div className="p-4 bg-destructive/10 border-2 border-destructive/30 rounded-lg text-destructive text-sm font-medium">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={isLoading || !passwordValidation.isValid}
        className="w-full py-3 px-6 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed transition-all font-semibold shadow-lg hover:shadow-xl"
      >
        {isLoading ? 'Creating account...' : 'Sign Up'}
      </button>

      <div className="text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <a href="/auth/login" className="text-primary hover:underline font-semibold">
          Login
        </a>
      </div>
    </form>
  )
}
