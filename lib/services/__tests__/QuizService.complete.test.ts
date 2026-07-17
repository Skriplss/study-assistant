import { QuizService } from '../QuizService'
import { AnalyticsService } from '../AnalyticsService'
import { ReviewService } from '../ReviewService'

jest.mock('server-only', () => ({}))

jest.mock('../AIService', () => ({
  AIService: { verifyAnswer: jest.fn() },
}))

jest.mock('../AnalyticsService', () => ({
  AnalyticsService: { recordQuizCompletion: jest.fn().mockResolvedValue(undefined) },
}))

jest.mock('../ReviewService', () => ({
  ReviewService: { seedFromQuiz: jest.fn().mockResolvedValue(undefined) },
}))

const mockDb = { from: jest.fn() }
jest.mock('@/lib/supabase/server', () => ({
  getSupabaseAdmin: jest.fn(() => mockDb),
}))

const ANSWERS = [
  {
    id: 'a1',
    quiz_id: 'q1',
    question_id: 'qq1',
    user_answer: 'yes',
    is_correct: true,
    feedback: null,
    answered_at: '2026-07-01T00:00:00Z',
  },
  {
    id: 'a2',
    quiz_id: 'q1',
    question_id: 'qq2',
    user_answer: 'no',
    is_correct: false,
    feedback: null,
    answered_at: '2026-07-01T00:00:00Z',
  },
]

/** Fluent mock whose terminal await resolves to { data }. */
function thenable(data: unknown) {
  const chain: any = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data }),
    update: jest.fn().mockReturnThis(),
  }
  chain.then = (resolve: any) => Promise.resolve({ data }).then(resolve)
  return chain
}

function setupDb(quiz: Record<string, unknown>) {
  mockDb.from.mockImplementation((table: string) =>
    table === 'answers' ? thenable(ANSWERS) : thenable(quiz)
  )
}

const BASE_QUIZ = { total_questions: 2, user_id: 'u1', material_id: 'm1' }

describe('QuizService.completeQuiz idempotency', () => {
  beforeEach(() => jest.clearAllMocks())

  it('scores an open quiz and records it once', async () => {
    setupDb({ ...BASE_QUIZ, status: 'in_progress', score: null, completed_at: null })

    const result = await QuizService.completeQuiz('u1', 'q1')

    expect(result.score).toBe(50)
    expect(result.correctCount).toBe(1)
    expect(AnalyticsService.recordQuizCompletion).toHaveBeenCalledTimes(1)
    expect(ReviewService.seedFromQuiz).toHaveBeenCalledTimes(1)
  })

  it('does not record a second snapshot when the quiz is already completed', async () => {
    setupDb({
      ...BASE_QUIZ,
      status: 'completed',
      score: 50,
      completed_at: '2026-07-01T12:00:00Z',
    })

    const result = await QuizService.completeQuiz('u1', 'q1')

    // This is the double-click path that put four identical snapshots in the
    // live DB, and would have taken four SM-2 steps per question.
    expect(AnalyticsService.recordQuizCompletion).not.toHaveBeenCalled()
    expect(ReviewService.seedFromQuiz).not.toHaveBeenCalled()

    // Still answers the caller with what was recorded, so a duplicate click
    // shows results rather than an error.
    expect(result.score).toBe(50)
    expect(result.completedAt).toBe('2026-07-01T12:00:00Z')
    expect(result.answers).toHaveLength(2)
  })

  it('re-records after a retake, because retakeQuiz reopens the quiz', async () => {
    setupDb({ ...BASE_QUIZ, status: 'in_progress', score: null, completed_at: null })

    await QuizService.completeQuiz('u1', 'q1')

    expect(AnalyticsService.recordQuizCompletion).toHaveBeenCalledTimes(1)
    expect(ReviewService.seedFromQuiz).toHaveBeenCalledTimes(1)
  })

  it('still refuses a quiz that is not fully answered', async () => {
    setupDb({ ...BASE_QUIZ, total_questions: 5, status: 'in_progress', score: null, completed_at: null })

    await expect(QuizService.completeQuiz('u1', 'q1')).rejects.toThrow(
      'All questions must be answered'
    )
    expect(AnalyticsService.recordQuizCompletion).not.toHaveBeenCalled()
  })

  it('refuses a quiz owned by someone else', async () => {
    setupDb({ ...BASE_QUIZ, user_id: 'someone-else', status: 'completed', score: 50, completed_at: null })

    await expect(QuizService.completeQuiz('u1', 'q1')).rejects.toThrow('Quiz not found')
  })
})
