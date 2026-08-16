import { QuizService } from '../QuizService'

jest.mock('server-only', () => ({}))

jest.mock('../AIService', () => ({ AIService: { verifyAnswer: jest.fn() } }))

const mockDb = { from: jest.fn() }
jest.mock('@/lib/supabase/server', () => ({
  getSupabaseAdmin: jest.fn(() => mockDb),
}))

const QUESTIONS = [
  {
    id: 'qq1',
    quiz_id: 'q1',
    question_text: 'What is osmosis?',
    question_type: 'open_ended',
    difficulty: 'medium',
    options: null,
    correct_answer: 'Water moving across a membrane',
    explanation: 'Down the concentration gradient.',
    order_index: 0,
  },
]

/** Minimal fluent stand-in: quizzes → the row, questions/answers → arrays. */
function stubDb(status: string) {
  mockDb.from.mockImplementation((table: string) => {
    const chain: Record<string, unknown> = {
      select: jest.fn(() => chain),
      eq: jest.fn(() => chain),
      order: jest.fn(() => chain),
      single: jest.fn().mockResolvedValue({
        data: {
          id: 'q1',
          user_id: 'u1',
          material_id: 'm1',
          title: 'Bio quiz',
          difficulty: 'medium',
          total_questions: 1,
          status,
          score: status === 'completed' ? 100 : null,
          completed_at: null,
          created_at: '2026-08-01T00:00:00Z',
        },
      }),
      then: (resolve: (value: { data: unknown }) => unknown) =>
        Promise.resolve({
          data: table === 'questions' ? QUESTIONS : [],
        }).then(resolve),
    }
    return chain
  })
}

beforeEach(() => jest.clearAllMocks())

describe('QuizService.getQuiz', () => {
  it.each(['draft', 'in_progress'])(
    'withholds the answer key while the quiz is %s',
    async (status) => {
      stubDb(status)

      const quiz = await QuizService.getQuiz('q1')

      expect(quiz.questions[0].questionText).toBe('What is osmosis?')
      expect(quiz.questions[0].correctAnswer).toBeNull()
      expect(quiz.questions[0].explanation).toBeNull()
      // The answer must not survive anywhere else in the payload either.
      expect(JSON.stringify(quiz)).not.toContain(
        'Water moving across a membrane'
      )
    }
  )

  it('hands the answers over once the quiz is completed', async () => {
    stubDb('completed')

    const quiz = await QuizService.getQuiz('q1')

    expect(quiz.questions[0].correctAnswer).toBe(
      'Water moving across a membrane'
    )
    expect(quiz.questions[0].explanation).toBe(
      'Down the concentration gradient.'
    )
  })
})
