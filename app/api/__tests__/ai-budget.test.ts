/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server'
import { POST as chat } from '../chat/route'
import { POST as generateQuiz } from '../quizzes/generate/route'
import { POST as analyzeGraph } from '../graph/analyze/route'
import { getSupabaseAdmin } from '@/lib/supabase/server'

const mockDb = {
  rpc: jest.fn(),
  auth: { getUser: jest.fn() },
}

jest.mock('server-only', () => ({}))

jest.mock('@/lib/supabase/server', () => ({
  getSupabaseAdmin: jest.fn(() => mockDb),
  getSupabaseAuthClient: jest.fn(() => mockDb),
}))

// The services behind these routes must never be reached once the budget is out —
// that is the entire point, so they throw if they are. The thrower is spelled out
// in every factory because jest hoists these calls above every const in the file.
jest.mock('@/lib/services/GraphService', () => ({
  GraphService: {
    analyzeConnections: jest.fn(() => {
      throw new Error('service should not run for a throttled request')
    }),
  },
}))
jest.mock('@/lib/services/QuizService', () => ({
  QuizService: {
    createQuiz: jest.fn(() => {
      throw new Error('service should not run for a throttled request')
    }),
  },
}))
jest.mock('@/lib/services/GlobalChatService', () => ({
  GlobalChatService: {
    buildContext: jest.fn(() => {
      throw new Error('service should not run for a throttled request')
    }),
  },
}))
jest.mock('@/lib/services/ConversationService', () => ({
  ConversationService: {
    create: jest.fn(() => {
      throw new Error('service should not run for a throttled request')
    }),
    assertOwned: jest.fn(() => {
      throw new Error('service should not run for a throttled request')
    }),
    appendMessage: jest.fn(() => {
      throw new Error('service should not run for a throttled request')
    }),
  },
}))

const admin = getSupabaseAdmin() as unknown as typeof mockDb

const post = (path: string, body: object) =>
  new NextRequest(`http://localhost${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      authorization: 'Bearer token',
    },
    body: JSON.stringify(body),
  })

beforeEach(() => {
  jest.clearAllMocks()
  admin.auth.getUser.mockResolvedValue({
    data: { user: { id: 'u1' } },
    error: null,
  })
  admin.rpc.mockResolvedValue({
    data: new Date(Date.now() + 300_000).toISOString(),
    error: null,
  })
})

describe('model-call budget', () => {
  it.each([
    ['chat', () => chat(post('/api/chat', { message: 'hi' })), 'chat:user:u1'],
    [
      'quiz generation',
      () =>
        generateQuiz(
          post('/api/quizzes/generate', { materialId: 'm1', questionCount: 5 })
        ),
      'quiz-generate:user:u1',
    ],
    [
      'graph analysis',
      () => analyzeGraph(post('/api/graph/analyze', {})),
      'graph-analyze:user:u1',
    ],
  ])(
    'stops %s at the limit, keyed on the account',
    async (_name, call, key) => {
      const response = await call()

      expect(response.status).toBe(429)
      expect(Number(response.headers.get('Retry-After'))).toBeGreaterThan(0)
      expect(admin.rpc.mock.calls[0][1].p_keys).toEqual([key])
    }
  )

  it('does not spend the budget on an unauthenticated caller', async () => {
    admin.auth.getUser.mockResolvedValue({ data: { user: null }, error: null })

    const response = await chat(post('/api/chat', { message: 'hi' }))

    expect(response.status).toBe(401)
    expect(admin.rpc).not.toHaveBeenCalled()
  })
})
