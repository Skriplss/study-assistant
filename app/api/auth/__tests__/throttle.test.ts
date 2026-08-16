/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server'
import { POST as login } from '../login/route'
import { POST as resetPassword } from '../reset-password/route'
import { getSupabaseAdmin } from '@/lib/supabase/server'

const mockDb = {
  rpc: jest.fn(),
  auth: {
    signInWithPassword: jest.fn(),
    resetPasswordForEmail: jest.fn().mockResolvedValue({ error: null }),
  },
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn().mockResolvedValue({ data: null }),
      })),
    })),
  })),
}

jest.mock('server-only', () => ({}))

jest.mock('@/lib/supabase/server', () => ({
  getSupabaseAdmin: jest.fn(() => mockDb),
  getSupabaseAuthClient: jest.fn(() => mockDb),
}))

const admin = getSupabaseAdmin() as unknown as typeof mockDb

const loginRequest = (body: object, headers: Record<string, string> = {}) =>
  new NextRequest('http://localhost/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })

/** The counter reports a block by returning when it lifts. */
const blockedFor = (seconds: number) => ({
  data: new Date(Date.now() + seconds * 1000).toISOString(),
  error: null,
})

const notBlocked = { data: null, error: null }

beforeEach(() => {
  jest.clearAllMocks()
  admin.rpc.mockResolvedValue(notBlocked)
})

describe('login throttling', () => {
  it('refuses the attempt with 429 and a Retry-After once blocked', async () => {
    admin.rpc.mockResolvedValue(blockedFor(300))

    const response = await login(
      loginRequest({ email: 'victim@example.com', password: 'guess' })
    )

    expect(response.status).toBe(429)
    expect(Number(response.headers.get('Retry-After'))).toBeGreaterThan(0)
    // The point of counting first: Supabase is never asked.
    expect(admin.auth.signInWithPassword).not.toHaveBeenCalled()
  })

  it('counts the attempt before checking the password', async () => {
    admin.auth.signInWithPassword.mockResolvedValue({
      data: {},
      error: { message: 'Invalid login credentials' },
    })

    await login(
      loginRequest({ email: 'victim@example.com', password: 'guess' })
    )

    const [fn, args] = admin.rpc.mock.calls[0]
    expect(fn).toBe('register_auth_attempt')
    expect(args.p_keys).toContain('login:email:victim@example.com')
  })

  it('keys on the address the platform reports, not one the client supplies', async () => {
    admin.auth.signInWithPassword.mockResolvedValue({
      data: {},
      error: { message: 'no' },
    })

    await login(
      loginRequest(
        { email: 'a@example.com', password: 'x' },
        {
          'x-vercel-forwarded-for': '203.0.113.9',
          'x-forwarded-for': '1.2.3.4',
        }
      )
    )

    expect(admin.rpc.mock.calls[0][1].p_keys).toContain('login:ip:203.0.113.9')
  })

  it('normalises the email so case cannot be used to get a fresh budget', async () => {
    admin.auth.signInWithPassword.mockResolvedValue({
      data: {},
      error: { message: 'no' },
    })

    await login(loginRequest({ email: 'VICTIM@Example.com ', password: 'x' }))

    expect(admin.rpc.mock.calls[0][1].p_keys).toContain(
      'login:email:victim@example.com'
    )
  })

  it('clears the counter after a correct password', async () => {
    admin.auth.signInWithPassword.mockResolvedValue({
      data: {
        user: { id: 'u1', email: 'a@example.com' },
        session: { access_token: 't', refresh_token: 'r', expires_in: 3600 },
      },
      error: null,
    })

    await login(loginRequest({ email: 'a@example.com', password: 'right' }))

    expect(admin.rpc).toHaveBeenCalledWith('clear_auth_attempts', {
      // The address keeps its count: one working account must not buy a fresh
      // guessing budget against every other account on the same host.
      p_keys: ['login:email:a@example.com'],
    })
  })

  it('does not let an absurd email blow up the key it is stored under', async () => {
    admin.auth.signInWithPassword.mockResolvedValue({
      data: {},
      error: { message: 'no' },
    })

    await login(
      loginRequest({ email: `${'a'.repeat(5000)}@example.com`, password: 'x' })
    )

    const keys: string[] = admin.rpc.mock.calls[0][1].p_keys
    expect(Math.max(...keys.map((k) => k.length))).toBeLessThan(300)
  })

  it('lets the request through when the counter itself is broken', async () => {
    // Fail-open is deliberate: a database hiccup must not lock everyone out.
    admin.rpc.mockResolvedValue({
      data: null,
      error: { message: 'relation missing' },
    })
    admin.auth.signInWithPassword.mockResolvedValue({
      data: {},
      error: { message: 'no' },
    })

    const response = await login(
      loginRequest({ email: 'a@example.com', password: 'x' })
    )

    expect(response.status).toBe(401)
  })
})

describe('password-reset throttling', () => {
  it('stops the mail rather than sending it', async () => {
    admin.rpc.mockResolvedValue(blockedFor(600))

    const request = new NextRequest(
      'http://localhost/api/auth/reset-password',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'victim@example.com' }),
      }
    )

    const response = await resetPassword(request)

    expect(response.status).toBe(429)
    expect(admin.auth.resetPasswordForEmail).not.toHaveBeenCalled()
  })
})
