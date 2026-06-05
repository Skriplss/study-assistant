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
    <form onSubmit={handleSubmit} className="space-y-4 w-full max-w-md">
      <div>
        <label htmlFor="name" className="block text-sm font-medium mb-1">
          Name (optional)
        </label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="John Doe"
          disabled={isLoading}
        />
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium mb-1">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="your@email.com"
          disabled={isLoading}
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium mb-1">
          Password
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="••••••••"
          disabled={isLoading}
        />
        {password && (
          <div className="mt-2">
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
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
              <span className="text-xs font-medium capitalize">
                {passwordStrength}
              </span>
            </div>
          </div>
        )}
        <div className="mt-2 text-xs text-gray-600 space-y-1">
          <p className="font-medium">Password must contain:</p>
          <ul className="list-disc list-inside space-y-0.5">
            <li className={password.length >= 8 ? 'text-green-600' : ''}>
              At least 8 characters
            </li>
            <li className={/[a-z]/.test(password) ? 'text-green-600' : ''}>
              One lowercase letter
            </li>
            <li className={/[A-Z]/.test(password) ? 'text-green-600' : ''}>
              One uppercase letter
            </li>
            <li className={/\d/.test(password) ? 'text-green-600' : ''}>
              One number
            </li>
          </ul>
        </div>
      </div>

      <div>
        <label
          htmlFor="confirmPassword"
          className="block text-sm font-medium mb-1"
        >
          Confirm Password
        </label>
        <input
          id="confirmPassword"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="••••••••"
          disabled={isLoading}
        />
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={isLoading || !passwordValidation.isValid}
        className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
      >
        {isLoading ? 'Creating account...' : 'Sign Up'}
      </button>

      <div className="text-center text-sm">
        Already have an account?{' '}
        <a href="/auth/login" className="text-blue-600 hover:underline">
          Login
        </a>
      </div>
    </form>
  )
}
