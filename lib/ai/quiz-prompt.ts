import type { QuizConfig } from '@/lib/types'
import { getLanguageName } from './language-detection'

const MAX_CONTENT_CHARS = 14_000

export function truncateContent(content: string): string {
  if (content.length <= MAX_CONTENT_CHARS) return content
  return `${content.slice(0, MAX_CONTENT_CHARS)}\n\n[Content truncated]`
}

export function buildQuizGenerationPrompt(
  content: string,
  config: QuizConfig,
  materialTitle?: string,
  language?: string
): string {
  const types = config.questionTypes.length > 0 
    ? config.questionTypes.join(', ') 
    : 'multiple_choice, open_ended'

  const languageInstruction = language && language !== 'en'
    ? `\nGenerate all questions, answers, and explanations in the following language: ${getLanguageName(language)}. Do not translate technical terms if they are commonly used in their original form.`
    : ''

  return `Create ${config.questionCount} educational quiz questions.

Title: ${materialTitle ?? 'Untitled'}
Difficulty: ${config.difficulty}
Types: ${types}${languageInstruction}

AVOID: authors, dates, publishers, metadata, trivial facts
FOCUS: concepts, processes, analysis, applications, key facts from content

RULES:
- Return valid JSON only (no markdown)
- Multiple choice: exactly 4 unique options, correctAnswer matches one exactly
- Open-ended: options=null, correctAnswer is 1-3 sentence model answer
- Questions must be clear, test understanding, answerable from material

JSON format:
{
  "title": "Quiz: ${materialTitle ?? 'Study Material'}",
  "questions": [
    {
      "questionText": "string",
      "questionType": "multiple_choice"|"open_ended",
      "difficulty": "easy"|"medium"|"hard",
      "options": ["a","b","c","d"]|null,
      "correctAnswer": "string",
      "explanation": "string",
      "orderIndex": 0
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
  return `Evaluate answer.

Type: ${questionType}
Q: ${questionText}
Expected: ${correctAnswer}
Student: ${userAnswer}

Return JSON only:
{"isCorrect": bool, "feedback": "string"}

Multiple choice: exact match (case-insensitive)
Open-ended: semantic match (accept paraphrases)`
}
