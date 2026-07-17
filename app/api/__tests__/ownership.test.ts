/**
 * @jest-environment node
 *
 * A valid token is only half the check — it says who you are, not what is yours.
 * These pin the second half: an authenticated user asking for someone else's
 * row gets nothing back.
 *
 * Worth pinning because the discipline is by convention, not by construction:
 * QuizService.getQuiz and MaterialService.getMaterial fetch by id and do no
 * ownership check of their own, leaving it to each caller. That works today —
 * every caller checks — but nothing makes the next one.
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

jest.mock('@/lib/services/QuizService', () => ({
  QuizService: {
    getQuiz: jest.fn(),
    submitAnswer: jest.fn(),
    completeQuiz: jest.fn(),
    getResults: jest.fn(),
    retakeQuiz: jest.fn(),
  },
}))

jest.mock('@/lib/services/MaterialService', () => ({
  MaterialService: {
    getMaterial: jest.fn(),
    getMaterialOwner: jest.fn(),
    updateMaterial: jest.fn(),
    deleteMaterial: jest.fn(),
  },
}))

jest.mock('@/lib/services/ConversationService', () => ({
  ConversationService: { getMessages: jest.fn(), remove: jest.fn() },
}))

jest.mock('@/lib/services/ReviewService', () => ({
  ReviewService: { grade: jest.fn() },
}))

/* eslint-disable @typescript-eslint/no-require-imports */
import { QuizService } from '@/lib/services/QuizService'
import { MaterialService } from '@/lib/services/MaterialService'
import { ConversationService } from '@/lib/services/ConversationService'
import { ReviewService } from '@/lib/services/ReviewService'

const ME = 'user-me'
const THEM = 'user-them'
const ID_CTX = { params: Promise.resolve({ id: 'resource-1' }) }

const request = (body?: unknown) =>
  new NextRequest('http://localhost/api/whatever', {
    method: 'POST',
    headers: { Authorization: 'Bearer valid-token', 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

beforeEach(() => {
  jest.clearAllMocks()
  // The token is genuine throughout — authentication is not what's under test.
  mockGetUser.mockResolvedValue({ data: { user: { id: ME, email: 'me@example.com' } }, error: null })
})

describe('quizzes owned by someone else', () => {
  it('GET /api/quizzes/[id] refuses to hand over another user\'s quiz', async () => {
    ;(QuizService.getQuiz as jest.Mock).mockResolvedValue({ id: 'resource-1', userId: THEM })

    const { GET } = require('../quizzes/[id]/route')
    const response = await GET(request(), ID_CTX)

    expect(response.status).toBe(403)
  })

  it('GET /api/quizzes/[id] returns a quiz that is mine', async () => {
    ;(QuizService.getQuiz as jest.Mock).mockResolvedValue({ id: 'resource-1', userId: ME })

    const { GET } = require('../quizzes/[id]/route')
    const response = await GET(request(), ID_CTX)

    expect(response.status).toBe(200)
  })

  // These four hand user.id to the service, which throws 'Quiz not found' rather
  // than distinguishing "missing" from "not yours" — deliberately, so the route
  // can't be used to probe for other people's ids.
  const serviceGuarded: Array<[string, string, jest.Mock, unknown]> = [
    ['POST /api/quizzes/[id]/answer', '../quizzes/[id]/answer/route', QuizService.submitAnswer as jest.Mock, { questionId: 'q1', answer: 'a' }],
    ['POST /api/quizzes/[id]/complete', '../quizzes/[id]/complete/route', QuizService.completeQuiz as jest.Mock, undefined],
    ['GET /api/quizzes/[id]/results', '../quizzes/[id]/results/route', QuizService.getResults as jest.Mock, undefined],
    ['POST /api/quizzes/[id]/retake', '../quizzes/[id]/retake/route', QuizService.retakeQuiz as jest.Mock, undefined],
  ]

  it.each(serviceGuarded)('%s passes the caller id to the service and surfaces its refusal', async (_name, path, serviceFn, body) => {
    serviceFn.mockRejectedValue(new Error('Quiz not found'))

    const mod = require(path)
    const handler = mod.POST ?? mod.GET
    const response = await handler(request(body), ID_CTX)

    expect(response.status).not.toBe(200)
    // The guard is only as good as the id it's given — assert we pass the
    // authenticated user, not something from the request body.
    expect(serviceFn).toHaveBeenCalledWith(ME, ...serviceFn.mock.calls[0].slice(1))
    expect(serviceFn.mock.calls[0][0]).toBe(ME)
  })
})

describe('materials owned by someone else', () => {
  it('GET /api/materials/[id] refuses another user\'s material', async () => {
    ;(MaterialService.getMaterial as jest.Mock).mockResolvedValue({ id: 'resource-1', userId: THEM })

    const { GET } = require('../materials/[id]/route')
    const response = await GET(request(), ID_CTX)

    expect(response.status).toBe(403)
  })

  it('PUT /api/materials/[id] refuses to edit another user\'s material', async () => {
    ;(MaterialService.getMaterialOwner as jest.Mock).mockResolvedValue(THEM)

    const { PUT } = require('../materials/[id]/route')
    const response = await PUT(request({ title: 'hijacked' }), ID_CTX)

    expect(response.status).toBe(403)
    expect(MaterialService.updateMaterial).not.toHaveBeenCalled()
  })

  it('DELETE /api/materials/[id] refuses to delete another user\'s material', async () => {
    ;(MaterialService.getMaterialOwner as jest.Mock).mockResolvedValue(THEM)

    const { DELETE } = require('../materials/[id]/route')
    const response = await DELETE(request(), ID_CTX)

    expect(response.status).toBe(403)
    expect(MaterialService.deleteMaterial).not.toHaveBeenCalled()
  })

  it('DELETE /api/materials/[id] deletes a material that is mine', async () => {
    ;(MaterialService.getMaterialOwner as jest.Mock).mockResolvedValue(ME)
    ;(MaterialService.deleteMaterial as jest.Mock).mockResolvedValue(undefined)

    const { DELETE } = require('../materials/[id]/route')
    const response = await DELETE(request(), ID_CTX)

    expect(response.status).toBe(200)
    expect(MaterialService.deleteMaterial).toHaveBeenCalledWith('resource-1')
  })
})

describe('conversations owned by someone else', () => {
  it('GET /api/conversations/[id] 404s rather than revealing it exists', async () => {
    ;(ConversationService.getMessages as jest.Mock).mockRejectedValue(
      new Error('Conversation not found')
    )

    const { GET } = require('../conversations/[id]/route')
    const response = await GET(request(), ID_CTX)

    expect(response.status).toBe(404)
    expect(ConversationService.getMessages).toHaveBeenCalledWith(ME, 'resource-1')
  })

  it('DELETE /api/conversations/[id] 404s for another user\'s thread', async () => {
    ;(ConversationService.remove as jest.Mock).mockRejectedValue(
      new Error('Conversation not found')
    )

    const { DELETE } = require('../conversations/[id]/route')
    const response = await DELETE(request(), ID_CTX)

    expect(response.status).toBe(404)
    expect(ConversationService.remove).toHaveBeenCalledWith(ME, 'resource-1')
  })
})

describe('review items owned by someone else', () => {
  it('POST /api/review/grade 404s for a question not scheduled for me', async () => {
    ;(ReviewService.grade as jest.Mock).mockRejectedValue(new Error('Review item not found'))

    const { POST } = require('../review/grade/route')
    const response = await POST(request({ questionId: 'q1', userAnswer: 'x' }))

    expect(response.status).toBe(404)
    expect(ReviewService.grade).toHaveBeenCalledWith(ME, 'q1', 'x')
  })
})
