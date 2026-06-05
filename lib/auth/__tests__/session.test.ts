/**
 * @jest-environment jsdom
 */
import { renderHook, waitFor } from '@testing-library/react'
import { useAuth, signOut } from '../session'
import { supabase } from '@/lib/supabase/client'

// Mock Supabase client
jest.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(),
      signOut: jest.fn(),
    },
  },
}))

describe('useAuth', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should return null user when not authenticated', async () => {
    ;(supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: { session: null },
    })
    ;(supabase.auth.onAuthStateChange as jest.Mock).mockReturnValue({
      data: { subscription: { unsubscribe: jest.fn() } },
    })

    const { result } = renderHook(() => useAuth())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.user).toBeNull()
    expect(result.current.session).toBeNull()
  })

  it('should return user when authenticated', async () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      created_at: new Date().toISOString(),
    }
    const mockSession = {
      user: mockUser,
      access_token: 'token',
      refresh_token: 'refresh',
    }

    ;(supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: { session: mockSession },
    })
    ;(supabase.auth.onAuthStateChange as jest.Mock).mockReturnValue({
      data: { subscription: { unsubscribe: jest.fn() } },
    })

    const { result } = renderHook(() => useAuth())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.user).toEqual(mockUser)
    expect(result.current.session).toEqual(mockSession)
  })
})

describe('signOut', () => {
  it('should call supabase signOut', async () => {
    ;(supabase.auth.signOut as jest.Mock).mockResolvedValue({ error: null })

    await signOut()

    expect(supabase.auth.signOut).toHaveBeenCalledTimes(1)
  })
})
