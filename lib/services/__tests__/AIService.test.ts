import { AIService } from '../AIService'
import { AIServiceError } from '@/lib/ai/errors'
import type { QuizConfig } from '@/lib/types'

const validQuizJson = {
  title: 'Sample Quiz',
  questions: [
    {
      questionText: 'What is 2+2?',
      questionType: 'multiple_choice',
      difficulty: 'easy',
      options: ['3', '4', '5', '6'],
      correctAnswer: '4',
      explanation: 'Basic arithmetic',
    },
  ],
}

function mockGroqResponse(
  content: string | { error?: { message?: string } },
  status = 200,
  headers?: HeadersInit
) {
  const body =
    typeof content === 'string'
      ? { choices: [{ message: { content } }] }
      : content

  return jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(headers),
    json: async () => body,
  })
}

describe('AIService.parseQuizResponse', () => {
  it('should parse JSON wrapped in markdown fences', () => {
    const raw = '```json\n' + JSON.stringify(validQuizJson) + '\n```'
    const quiz = AIService.parseQuizResponse(raw)
    expect(quiz.title).toBe('Sample Quiz')
    expect(quiz.questions).toHaveLength(1)
  })

  it('should throw on invalid structure', () => {
    expect(() => AIService.parseQuizResponse('{"foo": 1}')).toThrow(
      AIServiceError
    )
  })
})

describe('AIService.generateQuiz', () => {
  // questionCount 1 keeps the retry/error tests to a single generation round
  // (no top-up), so their fetch-call assertions stay meaningful.
  const config: QuizConfig = {
    questionCount: 1,
    difficulty: 'medium',
    questionTypes: ['multiple_choice'],
  }

  const originalKey = process.env.GROQ_API_KEY

  beforeEach(() => {
    process.env.GROQ_API_KEY = 'test-key'
    AIService.resetFetchImplementation()
  })

  afterEach(() => {
    process.env.GROQ_API_KEY = originalKey
    AIService.resetFetchImplementation()
  })

  it('should generate quiz from AI response', async () => {
    AIService.setFetchImplementation(
      mockGroqResponse(JSON.stringify(validQuizJson))
    )

    const quiz = await AIService.generateQuiz('Study content about math.', config)

    expect(quiz.title).toBe('Sample Quiz')
    expect(quiz.questions[0].correctAnswer).toBe('4')
  })

  it('should retry on server errors', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        headers: new Headers(),
        json: async () => ({ error: { message: 'unavailable' } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(validQuizJson) } }],
        }),
      })

    AIService.setFetchImplementation(fetchMock)

    const quiz = await AIService.generateQuiz('Content', config)
    expect(quiz.title).toBe('Sample Quiz')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('should throw quota error without retrying', async () => {
    AIService.setFetchImplementation(
      mockGroqResponse({ error: { message: 'quota exceeded' } }, 429, {
        'retry-after': '120',
      })
    )

    await expect(
      AIService.generateQuiz('Content', config)
    ).rejects.toMatchObject({ code: 'quota' })
  })

  it('should throw timeout error', async () => {
    const abortError = new Error('Aborted')
    abortError.name = 'AbortError'
    AIService.setFetchImplementation(jest.fn().mockRejectedValue(abortError))

    await expect(
      AIService.generateQuiz('Content', config)
    ).rejects.toMatchObject({ code: 'timeout' })
  })

  it('should throw config error when API key missing', async () => {
    delete process.env.GROQ_API_KEY

    await expect(
      AIService.generateQuiz('Content', config)
    ).rejects.toMatchObject({ code: 'config' })
  })

  it('tops up with a second round when the model returns too few questions', async () => {
    const mcq = (label: string) => ({
      questionText: `Question number ${label} about the topic?`,
      questionType: 'multiple_choice',
      difficulty: 'easy',
      options: [`${label}-1`, `${label}-2`, `${label}-3`, `${label}-4`],
      correctAnswer: `${label}-1`,
      explanation: 'because',
    })
    const okJson = (obj: unknown) => ({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => ({ choices: [{ message: { content: JSON.stringify(obj) } }] }),
    })

    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(okJson({ title: 'Q', questions: [mcq('A'), mcq('B')] }))
      .mockResolvedValueOnce(okJson({ questions: [mcq('C'), mcq('D')] }))
    AIService.setFetchImplementation(fetchMock)

    const quiz = await AIService.generateQuiz('content', { ...config, questionCount: 3 })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(quiz.questions).toHaveLength(3)
  })
})

describe('AIService.salvageQuestions', () => {
  it('recovers complete objects from truncated JSON', () => {
    const truncated =
      '{"title":"T","questions":[' +
      '{"questionText":"Q1","correctAnswer":"a"},' +
      '{"questionText":"Q2","correctAnswer":"b"},' +
      '{"questionText":"Q3","correctAns'
    const objs = AIService.salvageQuestions(truncated)
    expect(objs).toHaveLength(2)
    expect(objs[0].questionText).toBe('Q1')
    expect(objs[1].questionText).toBe('Q2')
  })

  it('ignores braces that appear inside string values', () => {
    const text = '{"questions":[{"questionText":"What is {x}?","correctAnswer":"a"}]}'
    const objs = AIService.salvageQuestions(text)
    expect(objs).toHaveLength(1)
    expect(objs[0].questionText).toBe('What is {x}?')
  })
})

describe('AIService.verifyAnswer', () => {
  const originalKey = process.env.GROQ_API_KEY

  beforeEach(() => {
    process.env.GROQ_API_KEY = 'test-key'
    AIService.resetFetchImplementation()
  })

  afterEach(() => {
    process.env.GROQ_API_KEY = originalKey
    AIService.resetFetchImplementation()
  })

  it('should verify multiple choice locally when correct', async () => {
    const fetchMock = jest.fn()
    AIService.setFetchImplementation(fetchMock)

    const result = await AIService.verifyAnswer(
      {
        id: 'q1',
        quizId: 'quiz-1',
        questionText: 'Pick one',
        questionType: 'multiple_choice',
        difficulty: 'medium',
        options: ['A', 'B'],
        correctAnswer: 'B',
        explanation: null,
        orderIndex: 0,
      },
      'b'
    )

    expect(result.isCorrect).toBe(true)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('should call AI for open-ended verification', async () => {
    AIService.setFetchImplementation(
      mockGroqResponse(
        JSON.stringify({
          isCorrect: true,
          feedback: 'Good answer',
          correctAnswer: 'mitochondria',
        })
      )
    )

    const result = await AIService.verifyAnswer(
      {
        id: 'q2',
        quizId: 'quiz-1',
        questionText: 'Powerhouse of the cell?',
        questionType: 'open_ended',
        difficulty: 'medium',
        options: null,
        correctAnswer: 'mitochondria',
        explanation: null,
        orderIndex: 0,
      },
      'the mitochondrion'
    )

    expect(result.isCorrect).toBe(true)
    expect(result.feedback).toContain('Good')
  })
})

describe('AIService.streamChat', () => {
  const originalKey = process.env.GROQ_API_KEY

  beforeEach(() => {
    process.env.GROQ_API_KEY = 'test-key'
    AIService.resetFetchImplementation()
  })

  afterEach(() => {
    process.env.GROQ_API_KEY = originalKey
    AIService.resetFetchImplementation()
  })

  async function drain(gen: AsyncGenerator<string>): Promise<string> {
    let out = ''
    for await (const delta of gen) out += delta
    return out
  }

  // A rate limit used to fall through to the buffered path, which retried behind
  // Groq's ~25s retry-after and then surfaced as a generic failure. The caller
  // needs the code to tell the user how long to wait.
  it('surfaces a rate limit instead of falling back to the buffered path', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 429,
      headers: new Headers({ 'retry-after': '23' }),
      json: async () => ({ error: { message: 'Rate limit reached ... (TPM): Limit 8000' } }),
    })
    AIService.setFetchImplementation(fetchMock)

    await expect(drain(AIService.streamChat([{ role: 'user', content: 'hi' }]))).rejects.toMatchObject(
      { code: 'rate_limit', retryAfterSeconds: 23 }
    )
    // No second call: the buffered path must not re-spend the exhausted window.
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('still falls back to the buffered path on a server error', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        headers: new Headers(),
        json: async () => ({ error: { message: 'unavailable' } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({ choices: [{ message: { content: 'buffered answer' } }] }),
      })
    AIService.setFetchImplementation(fetchMock)

    await expect(drain(AIService.streamChat([{ role: 'user', content: 'hi' }]))).resolves.toBe(
      'buffered answer'
    )
  })
})
