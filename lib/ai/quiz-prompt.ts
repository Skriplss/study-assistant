import type { QuizConfig } from '@/lib/types'

const MAX_CONTENT_CHARS = 14_000

export function truncateContent(content: string): string {
  if (content.length <= MAX_CONTENT_CHARS) return content
  return `${content.slice(0, MAX_CONTENT_CHARS)}\n\n[Content truncated for quiz generation]`
}

export function buildQuizGenerationPrompt(
  content: string,
  config: QuizConfig,
  materialTitle?: string
): string {
  const types =
    config.questionTypes.length > 0
      ? config.questionTypes.join(', ')
      : 'multiple_choice, open_ended'

  return `You are an expert educator. Generate a study quiz from the material below.

Material title: ${materialTitle ?? 'Untitled'}
Question count: ${config.questionCount}
Overall difficulty preference: ${config.difficulty}
Question types to include: ${types}

Rules:
- Return ONLY valid JSON, no markdown fences or extra text.
- Generate exactly ${config.questionCount} questions.
- For multiple_choice: provide exactly 4 options and set correctAnswer to the exact text of the correct option.
- For open_ended: set options to null and correctAnswer to a concise model answer.
- Assign each question difficulty: easy, medium, or hard.
- If difficulty is "mixed", vary difficulties across questions.
- Base questions strictly on the provided material.

JSON schema:
{
  "title": "string",
  "questions": [
    {
      "questionText": "string",
      "questionType": "multiple_choice" | "open_ended",
      "difficulty": "easy" | "medium" | "hard",
      "options": ["string"] | null,
      "correctAnswer": "string",
      "explanation": "string"
    }
  ]
}

Material:
${truncateContent(content)}`
}

export function buildAnswerVerificationPrompt(
  questionText: string,
  correctAnswer: string,
  userAnswer: string,
  questionType: 'multiple_choice' | 'open_ended'
): string {
  return `Evaluate the student's answer.

Question type: ${questionType}
Question: ${questionText}
Expected answer: ${correctAnswer}
Student answer: ${userAnswer}

Return ONLY valid JSON:
{
  "isCorrect": boolean,
  "feedback": "string explaining the result",
  "correctAnswer": "string (include for multiple_choice when incorrect)"
}

For multiple_choice, isCorrect is true only if the student answer matches the expected option exactly (case-insensitive).
For open_ended, use semantic similarity — accept paraphrases that capture the same meaning.`
}
