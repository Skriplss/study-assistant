import { AnalyticsService } from '../AnalyticsService'

// Mock server-only
jest.mock('server-only', () => ({}))

const mockDb = {
  from: jest.fn(),
  rpc: jest.fn(),
}

jest.mock('@/lib/supabase/server', () => ({
  getSupabaseAdmin: jest.fn(() => mockDb),
}))

// Fluent query chain helper
function makeQuery(data: any, error: any = null) {
  const chain: any = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockResolvedValue({ error }),
    eq: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
  }
  chain.then = (resolve: any) => Promise.resolve({ data, error }).then(resolve)
  return chain
}

describe('AnalyticsService.recordQuizCompletion', () => {
  beforeEach(() => jest.clearAllMocks())

  it('inserts a progress snapshot with correct fields', async () => {
    const insertMock = jest.fn().mockResolvedValue({ error: null })
    mockDb.from.mockReturnValue({ insert: insertMock })

    await AnalyticsService.recordQuizCompletion(
      'user-1', 'quiz-1', 85.5, 'material-1', 10, 8
    )

    expect(mockDb.from).toHaveBeenCalledWith('progress_snapshots')
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        quiz_id: 'quiz-1',
        material_id: 'material-1',
        score: 85.5,
        questions_count: 10,
        correct_count: 8,
      })
    )
  })

  it('uses defaults (0) for optional questions_count and correct_count', async () => {
    const insertMock = jest.fn().mockResolvedValue({ error: null })
    mockDb.from.mockReturnValue({ insert: insertMock })

    await AnalyticsService.recordQuizCompletion('u', 'q', 50, 'm')

    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({ questions_count: 0, correct_count: 0 })
    )
  })

  it('stores completed_at as an ISO string', async () => {
    const insertMock = jest.fn().mockResolvedValue({ error: null })
    mockDb.from.mockReturnValue({ insert: insertMock })

    await AnalyticsService.recordQuizCompletion('u', 'q', 70, 'm', 5, 3)

    const { completed_at } = insertMock.mock.calls[0][0]
    expect(() => new Date(completed_at)).not.toThrow()
    expect(new Date(completed_at).toISOString()).toBe(completed_at)
  })
})

describe('AnalyticsService.getProgressData', () => {
  beforeEach(() => jest.clearAllMocks())

  const snapshots = [
    { quiz_id: 'q1', score: 80, completed_at: '2026-05-01T00:00:00.000Z' },
    { quiz_id: 'q2', score: 60, completed_at: '2026-05-10T00:00:00.000Z' },
  ]
  const materials = [{ id: 'm1' }, { id: 'm2' }, { id: 'm3' }]
  const quizzes = [
    { id: 'q1', total_questions: 10 },
    { id: 'q2', total_questions: 5 },
  ]

  function setupMocks() {
    mockDb.from.mockImplementation((table: string) => {
      if (table === 'progress_snapshots') return makeQuery(snapshots)
      if (table === 'study_materials') return makeQuery(materials)
      if (table === 'quizzes') return makeQuery(quizzes)
      return makeQuery([])
    })
    mockDb.rpc.mockResolvedValue({ data: [] })
  }

  it('calculates average score correctly', async () => {
    setupMocks()
    const result = await AnalyticsService.getProgressData('user-1', '30d')
    // (80 + 60) / 2 = 70
    expect(result.averageScore).toBe(70)
  })

  it('counts total materials, quizzes and questions', async () => {
    setupMocks()
    const result = await AnalyticsService.getProgressData('user-1', '30d')
    expect(result.totalMaterials).toBe(3)
    expect(result.totalQuizzes).toBe(2)
    expect(result.totalQuestions).toBe(15) // 10 + 5
  })

  it('builds scoreHistory from snapshots', async () => {
    setupMocks()
    const result = await AnalyticsService.getProgressData('user-1', '30d')
    expect(result.scoreHistory).toHaveLength(2)
    expect(result.scoreHistory[0]).toMatchObject({
      date: '2026-05-01T00:00:00.000Z',
      score: 80,
      quizId: 'q1',
    })
  })

  it('returns zero averageScore when no snapshots', async () => {
    mockDb.from.mockImplementation((table: string) => {
      if (table === 'progress_snapshots') return makeQuery([])
      if (table === 'study_materials') return makeQuery([])
      if (table === 'quizzes') return makeQuery([])
      return makeQuery([])
    })
    mockDb.rpc.mockResolvedValue({ data: [] })

    const result = await AnalyticsService.getProgressData('user-1')
    expect(result.averageScore).toBe(0)
    expect(result.scoreHistory).toHaveLength(0)
  })

  it('rounds averageScore to 1 decimal', async () => {
    const oddSnapshots = [
      { quiz_id: 'q1', score: 100, completed_at: '2026-01-01T00:00:00.000Z' },
      { quiz_id: 'q2', score: 50, completed_at: '2026-01-02T00:00:00.000Z' },
      { quiz_id: 'q3', score: 75, completed_at: '2026-01-03T00:00:00.000Z' },
    ]
    mockDb.from.mockImplementation((table: string) => {
      if (table === 'progress_snapshots') return makeQuery(oddSnapshots)
      if (table === 'study_materials') return makeQuery([])
      if (table === 'quizzes') return makeQuery([])
      return makeQuery([])
    })
    mockDb.rpc.mockResolvedValue({ data: [] })

    const result = await AnalyticsService.getProgressData('user-1')
    // (100 + 50 + 75) / 3 = 75.0
    expect(result.averageScore).toBe(75)
  })
})

describe('AnalyticsService time range filtering', () => {
  beforeEach(() => jest.clearAllMocks())

  it('uses correct start date for 7d range', async () => {
    let capturedGte: string | undefined
    const chain: any = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn((_, val) => { capturedGte = val; return chain }),
      order: jest.fn().mockReturnThis(),
      then: (resolve: any) => Promise.resolve({ data: [] }).then(resolve),
    }
    mockDb.from.mockReturnValue(chain)
    mockDb.rpc.mockResolvedValue({ data: [] })

    const before = Date.now()
    await AnalyticsService.getProgressData('user-1', '7d')
    const after = Date.now()

    const gteDate = new Date(capturedGte!).getTime()
    const expected7dAgo = before - 7 * 24 * 60 * 60 * 1000
    const expected7dAgoEnd = after - 7 * 24 * 60 * 60 * 1000
    expect(gteDate).toBeGreaterThanOrEqual(expected7dAgo - 1000)
    expect(gteDate).toBeLessThanOrEqual(expected7dAgoEnd + 1000)
  })

  it('defaults to 30d when range not specified', async () => {
    let capturedGte: string | undefined
    const chain: any = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn((_, val) => { capturedGte = val; return chain }),
      order: jest.fn().mockReturnThis(),
      then: (resolve: any) => Promise.resolve({ data: [] }).then(resolve),
    }
    mockDb.from.mockReturnValue(chain)
    mockDb.rpc.mockResolvedValue({ data: [] })

    const before = Date.now()
    await AnalyticsService.getProgressData('user-1')
    const after = Date.now()

    const gteDate = new Date(capturedGte!).getTime()
    const expected30dAgo = before - 30 * 24 * 60 * 60 * 1000
    const expected30dAgoEnd = after - 30 * 24 * 60 * 60 * 1000
    expect(gteDate).toBeGreaterThanOrEqual(expected30dAgo - 1000)
    expect(gteDate).toBeLessThanOrEqual(expected30dAgoEnd + 1000)
  })
})
