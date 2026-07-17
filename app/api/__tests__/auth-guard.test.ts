/**
 * @jest-environment node
 *
 * Every protected route re-verifies the Bearer token itself — proxy.ts gates on
 * a cookie and is explicitly not the security boundary (see the note in its
 * handler). That makes these guards the only thing standing between one user's
 * request and another user's data, and they were almost entirely untested.
 *
 * This sweeps the guard on every handler at once, so a new route that forgets to
 * check, or an existing one that loses the check in a refactor, fails here.
 */

import { NextRequest } from 'next/server'

jest.mock('server-only', () => ({}))

const mockGetUser = jest.fn()

jest.mock('@/lib/supabase/server', () => ({
  getSupabaseAdmin: () => ({
    auth: { getUser: mockGetUser },
    from: jest.fn(),
    rpc: jest.fn(),
    storage: { from: jest.fn() },
  }),
}))

// The services must never be reached — an unauthenticated request has no
// business touching the DB or an AI provider. Mocked bare so that if a guard
// ever does fall through, the assertion fails loudly instead of doing real work.
jest.mock('@/lib/services/AIService', () => ({ AIService: {} }))
jest.mock('@/lib/services/QuizService', () => ({ QuizService: {} }))
jest.mock('@/lib/services/MaterialService', () => ({ MaterialService: {} }))
jest.mock('@/lib/services/MaterialParser', () => ({ MaterialParser: {} }))
jest.mock('@/lib/services/AnalyticsService', () => ({ AnalyticsService: {} }))
jest.mock('@/lib/services/GraphService', () => ({ GraphService: {} }))
jest.mock('@/lib/services/SearchService', () => ({ SearchService: {} }))
jest.mock('@/lib/services/ReviewService', () => ({ ReviewService: {} }))
jest.mock('@/lib/services/ConversationService', () => ({ ConversationService: {} }))
jest.mock('@/lib/services/GlobalChatService', () => ({ GlobalChatService: {} }))

/* eslint-disable @typescript-eslint/no-require-imports */
const load = (path: string) => require(path)

type Handler = (req: NextRequest, ctx?: unknown) => Promise<Response>

interface RouteCase {
  name: string
  handler: () => Handler
  /** Dynamic routes take a params promise as their second argument. */
  ctx?: unknown
  body?: unknown
}

const ID_CTX = { params: Promise.resolve({ id: 'some-id' }) }

const ROUTES: RouteCase[] = [
  { name: 'GET /api/materials', handler: () => load('../materials/route').GET },
  { name: 'POST /api/materials', handler: () => load('../materials/route').POST, body: {} },
  { name: 'GET /api/materials/[id]', handler: () => load('../materials/[id]/route').GET, ctx: ID_CTX },
  { name: 'PUT /api/materials/[id]', handler: () => load('../materials/[id]/route').PUT, ctx: ID_CTX, body: {} },
  { name: 'DELETE /api/materials/[id]', handler: () => load('../materials/[id]/route').DELETE, ctx: ID_CTX },
  { name: 'POST /api/materials/parse', handler: () => load('../materials/parse/route').POST, body: { materialId: 'm1' } },
  { name: 'GET /api/materials/search', handler: () => load('../materials/search/route').GET },

  { name: 'GET /api/quizzes', handler: () => load('../quizzes/route').GET },
  { name: 'POST /api/quizzes/generate', handler: () => load('../quizzes/generate/route').POST, body: {} },
  { name: 'GET /api/quizzes/[id]', handler: () => load('../quizzes/[id]/route').GET, ctx: ID_CTX },
  { name: 'POST /api/quizzes/[id]/answer', handler: () => load('../quizzes/[id]/answer/route').POST, ctx: ID_CTX, body: {} },
  { name: 'POST /api/quizzes/[id]/complete', handler: () => load('../quizzes/[id]/complete/route').POST, ctx: ID_CTX },
  { name: 'GET /api/quizzes/[id]/results', handler: () => load('../quizzes/[id]/results/route').GET, ctx: ID_CTX },
  { name: 'POST /api/quizzes/[id]/retake', handler: () => load('../quizzes/[id]/retake/route').POST, ctx: ID_CTX },

  { name: 'GET /api/analytics/progress', handler: () => load('../analytics/progress/route').GET },
  { name: 'GET /api/analytics/summary', handler: () => load('../analytics/summary/route').GET },
  { name: 'GET /api/analytics/performance', handler: () => load('../analytics/performance/route').GET },

  { name: 'GET /api/graph', handler: () => load('../graph/route').GET },
  { name: 'POST /api/graph/analyze', handler: () => load('../graph/analyze/route').POST, body: {} },

  { name: 'GET /api/categories', handler: () => load('../categories/route').GET },
  { name: 'GET /api/tags', handler: () => load('../tags/route').GET },

  { name: 'POST /api/chat', handler: () => load('../chat/route').POST, body: { message: 'hi' } },
  { name: 'GET /api/conversations', handler: () => load('../conversations/route').GET },
  { name: 'GET /api/conversations/[id]', handler: () => load('../conversations/[id]/route').GET, ctx: ID_CTX },
  { name: 'DELETE /api/conversations/[id]', handler: () => load('../conversations/[id]/route').DELETE, ctx: ID_CTX },

  { name: 'GET /api/review/due', handler: () => load('../review/due/route').GET },
  { name: 'POST /api/review/grade', handler: () => load('../review/grade/route').POST, body: { questionId: 'q1', userAnswer: 'x' } },

  { name: 'POST /api/feedback', handler: () => load('../feedback/route').POST, body: { message: 'hi' } },
  { name: 'GET /api/feedback', handler: () => load('../feedback/route').GET },
  { name: 'PATCH /api/feedback', handler: () => load('../feedback/route').PATCH, body: { id: 'f1', status: 'seen' } },
]

function request(auth: string | null, body?: unknown): NextRequest {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (auth) headers.Authorization = auth

  return new NextRequest('http://localhost/api/whatever', {
    method: 'POST',
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

describe('API auth guards', () => {
  beforeEach(() => jest.clearAllMocks())

  describe.each(ROUTES)('$name', ({ handler, ctx, body }) => {
    it('rejects a request with no Authorization header', async () => {
      const response = await handler()(request(null, body), ctx)

      expect(response.status).toBe(401)
      // Nothing should have been asked of Supabase — there's no token to check.
      expect(mockGetUser).not.toHaveBeenCalled()
    })

    it('rejects a token Supabase does not recognise', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'invalid JWT' },
      })

      const response = await handler()(request('Bearer forged-token', body), ctx)

      expect(response.status).toBe(401)
    })

    it('rejects an Authorization header that is not a Bearer token', async () => {
      // Guards vary: some check the "Bearer " prefix, others slice blindly and
      // hand the remainder to Supabase. Either way it must not authenticate.
      mockGetUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'invalid JWT' },
      })

      const response = await handler()(request('Basic aGk6dGhlcmU=', body), ctx)

      expect(response.status).toBe(401)
    })
  })
})
