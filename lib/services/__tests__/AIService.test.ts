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

describe('AIService.validateQuizConfig', () => {
  it('should reject question count below 5', () => {
    const result = AIService.validateQuizConfig({
      questionCount: 3,
      difficulty: 'easy',
      questionTypes: ['multiple_choice'],
    })
    expect(result.valid).toBe(false)
  })

  it('should accept valid configuration', () => {
    const result = AIService.validateQuizConfig({
      questionCount: 10,
      difficulty: 'mixed',
      questionTypes: ['multiple_choice', 'open_ended'],
    })
    expect(result.valid).toBe(true)
  })
})

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
  const config: QuizConfig = {
    questionCount: 5,
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
        questionText: 'Pick one',
        questionType: 'multiple_choice',
        correctAnswer: 'B',
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
        questionText: 'Powerhouse of the cell?',
        questionType: 'open_ended',
        correctAnswer: 'mitochondria',
      },
      'the mitochondrion'
    )

    expect(result.isCorrect).toBe(true)
    expect(result.feedback).toContain('Good')
  })
})
