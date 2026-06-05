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

  return `You are an expert educator creating a high-quality educational quiz. Generate clear, meaningful questions that test real understanding.

Material title: ${materialTitle ?? 'Untitled'}
Question count: ${config.questionCount}
Overall difficulty preference: ${config.difficulty}
Question types to include: ${types}

CRITICAL RULES:
- Return ONLY valid JSON, no markdown fences or extra text.
- Generate exactly ${config.questionCount} questions.

WHAT TO AVOID (DO NOT create questions about):
- Authors, writers, or who wrote something
- Publication dates, years, or when something was written
- Publishers, editors, or sources
- Book titles, chapter titles, or document metadata
- Page numbers or document structure
- Trivial or obvious information
- Information not present in the material

WHAT TO FOCUS ON (Create questions about):
- Key concepts and definitions
- Main ideas and arguments
- Processes, methods, and procedures
- Cause and effect relationships
- Applications and practical examples
- Problem-solving and analysis
- Comparisons and contrasts
- Important facts and data from the content

QUESTION QUALITY REQUIREMENTS:
- Questions must be clear, specific, and unambiguous
- Questions must test understanding, not just memorization
- Questions must be answerable from the provided material
- Each question must be unique and test different knowledge

MULTIPLE CHOICE REQUIREMENTS:
- Provide exactly 4 distinct options
- ALL 4 options must be DIFFERENT from each other
- Options should be plausible but only one correct
- Avoid options like "All of the above" or "None of the above"
- Make distractors (wrong answers) realistic but clearly incorrect
- correctAnswer must match one option EXACTLY

OPEN-ENDED REQUIREMENTS:
- Set options to null
- Provide a concise, clear model answer as correctAnswer
- Model answer should be 1-3 sentences

FORMAT:
{
  "title": "Quiz: ${materialTitle ?? 'Study Material'}",
  "difficulty": "${config.difficulty}",
  "totalQuestions": ${config.questionCount},
  "questions": [
    {
      "questionText": "string (clear, specific question)",
      "questionType": "multiple_choice" | "open_ended",
      "difficulty": "easy" | "medium" | "hard",
      "options": ["option1", "option2", "option3", "option4"] | null,
      "correctAnswer": "string (must match one option exactly for MC)",
      "explanation": "string (why this is the correct answer)",
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
