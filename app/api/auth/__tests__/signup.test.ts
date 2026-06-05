/**
 * @jest-environment node
 */

import { POST } from '../signup/route'
import { supabase } from '@/lib/supabase/client'

jest.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: {
      signUp: jest.fn(),
    },
    from: jest.fn(() => ({
      insert: jest.fn().mockResolvedValue({ error: null }),
    })),
  },
}))

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

    ;(supabase.auth.signUp as jest.Mock).mockResolvedValue({
      data: { user: mockUser, session: mockSession },
      error: null,
    })

    const request = new Request('http://localhost/api/auth/signup', {
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
    const request = new Request('http://localhost/api/auth/signup', {
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
    const request = new Request('http://localhost/api/auth/signup', {
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
    const request = new Request('http://localhost/api/auth/signup', {
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
