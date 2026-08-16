/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server'
import { POST } from '../change-password/route'
import { getSupabaseAdmin } from '@/lib/supabase/server'

const mockDb = {
  auth: {
    getUser: jest.fn(),
    admin: { updateUserById: jest.fn() },
  },
}

jest.mock('server-only', () => ({}))

jest.mock('@/lib/supabase/server', () => ({
  getSupabaseAdmin: jest.fn(() => mockDb),
}))

const admin = getSupabaseAdmin() as unknown as typeof mockDb

const request = (body: unknown, headers: Record<string, string> = {}) =>
  new NextRequest('http://localhost/api/auth/change-password', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      authorization: 'Bearer token',
      ...headers,
    },
    body: JSON.stringify(body),
  })

beforeEach(() => {
  jest.clearAllMocks()
  admin.auth.getUser.mockResolvedValue({
    data: { user: { id: 'u1' } },
    error: null,
  })
  admin.auth.admin.updateUserById.mockResolvedValue({ error: null })
})

describe('POST /api/auth/change-password', () => {
  it('sets the password when it meets the rules', async () => {
    const response = await POST(request({ password: 'ValidPass123' }))

    expect(response.status).toBe(200)
    expect(admin.auth.admin.updateUserById).toHaveBeenCalledWith('u1', {
      password: 'ValidPass123',
    })
  })

  it.each([
    ['too short', 'Ab1'],
    ['no uppercase', 'validpass123'],
    ['no lowercase', 'VALIDPASS123'],
    ['no digit', 'ValidPassword'],
  ])(
    'refuses a password that is %s — the browser is not the gate',
    async (_n, password) => {
      const response = await POST(request({ password }))

      expect(response.status).toBe(400)
      expect(admin.auth.admin.updateUserById).not.toHaveBeenCalled()
    }
  )

  it('refuses a non-string password instead of passing it on', async () => {
    const response = await POST(request({ password: { toString: 'nope' } }))

    expect(response.status).toBe(400)
    expect(admin.auth.admin.updateUserById).not.toHaveBeenCalled()
  })

  it('changes only the caller’s own account, whatever the body says', async () => {
    await POST(request({ password: 'ValidPass123', userId: 'someone-else' }))

    expect(admin.auth.admin.updateUserById).toHaveBeenCalledWith(
      'u1',
      expect.anything()
    )
  })

  it('rejects a request with no token', async () => {
    const response = await POST(
      new NextRequest('http://localhost/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'ValidPass123' }),
      })
    )

    expect(response.status).toBe(401)
    expect(admin.auth.admin.updateUserById).not.toHaveBeenCalled()
  })

  it('rejects a token Supabase does not recognise', async () => {
    admin.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'bad' },
    })

    const response = await POST(request({ password: 'ValidPass123' }))

    expect(response.status).toBe(401)
    expect(admin.auth.admin.updateUserById).not.toHaveBeenCalled()
  })
})
