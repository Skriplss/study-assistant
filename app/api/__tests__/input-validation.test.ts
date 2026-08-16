/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server'
import { POST as generateQuiz } from '../quizzes/generate/route'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { QuizService } from '@/lib/services/QuizService'

const mockDb = {
  rpc: jest.fn(),
  auth: { getUser: jest.fn() },
}

jest.mock('server-only', () => ({}))

jest.mock('@/lib/supabase/server', () => ({
  getSupabaseAdmin: jest.fn(() => mockDb),
}))

jest.mock('@/lib/services/QuizService', () => ({
  QuizService: { createQuiz: jest.fn() },
}))

const admin = getSupabaseAdmin() as unknown as typeof mockDb
const createQuiz = QuizService.createQuiz as jest.MockedFunction<
  typeof QuizService.createQuiz
>

const generate = (body: unknown) =>
  generateQuiz(
    new NextRequest('http://localhost/api/quizzes/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        authorization: 'Bearer token',
      },
      body: JSON.stringify(body),
    })
  )

beforeEach(() => {
  jest.clearAllMocks()
  admin.auth.getUser.mockResolvedValue({
    data: { user: { id: 'u1' } },
    error: null,
  })
  admin.rpc.mockResolvedValue({ data: null, error: null })
  createQuiz.mockResolvedValue({ id: 'q1' } as never)
})

describe('POST /api/quizzes/generate — questionCount', () => {
  it.each([
    ['negative', -100],
    ['zero', 0],
    ['fractional', 0.5],
    ['above the maximum', 51],
    ['below the minimum', 4],
    ['a numeric string', '10'],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['missing', undefined],
  ])('rejects %s', async (_name, questionCount) => {
    const response = await generate({ materialId: 'm1', questionCount })

    expect(response.status).toBe(400)
    // Nothing is generated and nothing is billed.
    expect(createQuiz).not.toHaveBeenCalled()
  })

  it.each([5, 20, 50])('accepts %i', async (questionCount) => {
    const response = await generate({ materialId: 'm1', questionCount })

    expect(response.status).toBe(201)
    expect(createQuiz).toHaveBeenCalledWith(
      'u1',
      'm1',
      expect.objectContaining({ questionCount })
    )
  })

  it('rejects a materialId that is not a string', async () => {
    const response = await generate({
      materialId: { $ne: null },
      questionCount: 5,
    })

    expect(response.status).toBe(400)
    expect(createQuiz).not.toHaveBeenCalled()
  })
})
