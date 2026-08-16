/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server'
import { GET } from '../callback/route'
import { getSupabaseAuthClient } from '@/lib/supabase/server'

const verifyOtp = jest.fn()

jest.mock('server-only', () => ({}))

jest.mock('@/lib/supabase/server', () => ({
  getSupabaseAuthClient: jest.fn(() => ({ auth: { verifyOtp } })),
}))

const callback = (query: string) =>
  GET(new NextRequest(`http://localhost/auth/callback?${query}`))

beforeEach(() => {
  jest.clearAllMocks()
  verifyOtp.mockResolvedValue({ error: null })
})

describe('GET /auth/callback', () => {
  it.each([
    ['absolute URL', 'https://evil.example/steal'],
    ['protocol-relative', '//evil.example/steal'],
    ['scheme-only', 'javascript:alert(1)'],
  ])('refuses to bounce to an off-site `next` (%s)', async (_name, next) => {
    const response = await callback(
      `token_hash=abc&type=recovery&next=${encodeURIComponent(next)}`
    )

    expect(response.headers.get('location')).toBe('http://localhost/dashboard')
  })

  it('keeps a same-origin path', async () => {
    const response = await callback(
      'token_hash=abc&type=recovery&next=%2Fquizzes'
    )

    expect(response.headers.get('location')).toBe('http://localhost/quizzes')
  })

  it('ignores an OTP type it does not recognise instead of forwarding it', async () => {
    const response = await callback('token_hash=abc&type=nonsense')

    expect(verifyOtp).not.toHaveBeenCalled()
    expect(response.headers.get('location')).toContain('verification_failed')
  })

  it('sends a failed verification to the login screen', async () => {
    verifyOtp.mockResolvedValue({ error: { message: 'expired' } })

    const response = await callback(
      'token_hash=abc&type=recovery&next=%2Fquizzes'
    )

    expect(response.headers.get('location')).toContain('verification_failed')
  })

  it('builds a client per request rather than sharing one', async () => {
    await callback('token_hash=abc&type=recovery')
    await callback('token_hash=def&type=recovery')

    expect(getSupabaseAuthClient).toHaveBeenCalledTimes(2)
  })
})
