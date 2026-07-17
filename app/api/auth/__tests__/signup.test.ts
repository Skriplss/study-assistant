/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server'
import { POST } from '../signup/route'
import { getSupabaseAdmin } from '@/lib/supabase/server'

// The route signs up through the service-role client, not the browser one —
// mocking @/lib/supabase/client left the real client in place and every request
// came back 400.
const mockDb = {
  auth: {
    signUp: jest.fn(),
  },
  from: jest.fn(() => ({
    insert: jest.fn().mockResolvedValue({ error: null }),
  })),
}

jest.mock('server-only', () => ({}))

jest.mock('@/lib/supabase/server', () => ({
  getSupabaseAdmin: jest.fn(() => mockDb),
}))

const admin = getSupabaseAdmin() as unknown as typeof mockDb

describe('POST /api/auth/signup', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should create a new user with valid credentials', async () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
    }
    const mockSession = {
      access_token: 'token',
      refresh_token: 'refresh',
    }

    admin.auth.signUp.mockResolvedValue({
      data: { user: mockUser, session: mockSession },
      error: null,
    })

    const request = new NextRequest('http://localhost/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'ValidPass123',
        name: 'Test User',
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.user.email).toBe('test@example.com')
  })

  it('should reject invalid email', async () => {
    const request = new NextRequest('http://localhost/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'invalid-email',
        password: 'ValidPass123',
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Invalid email format')
  })

  it('should reject weak password', async () => {
    const request = new NextRequest('http://localhost/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'weak',
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Password does not meet requirements')
  })

  it('should handle missing fields', async () => {
    const request = new NextRequest('http://localhost/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Email and password are required')
  })
})
