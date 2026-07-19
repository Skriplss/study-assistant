export type AIServiceErrorCode =
  | 'timeout'
  | 'rate_limit'
  | 'quota'
  | 'parse'
  | 'unavailable'
  | 'config'
  | 'too_large'
  | 'unknown'

export class AIServiceError extends Error {
  constructor(
    message: string,
    public readonly code: AIServiceErrorCode,
    public readonly retryAfterSeconds?: number
  ) {
    super(message)
    this.name = 'AIServiceError'
  }
}

/** HTTP status to surface for each AI failure mode. */
export const AI_ERROR_STATUS: Record<AIServiceErrorCode, number> = {
  rate_limit: 429,
  quota: 429,
  timeout: 504,
  unavailable: 503,
  config: 503,
  too_large: 413,
  parse: 502,
  unknown: 502,
}

export function getUserFriendlyAIError(error: unknown): string {
  if (error instanceof AIServiceError) {
    switch (error.code) {
      case 'rate_limit':
        return error.retryAfterSeconds
          ? `AI service is busy. Try again in ${error.retryAfterSeconds} seconds.`
          : 'AI service is busy. Please try again shortly.'
      case 'quota':
        return 'AI quota exceeded. Please try again later.'
      case 'timeout':
        return 'AI request timed out. Please try again.'
      case 'unavailable':
        return 'AI service is temporarily unavailable. Please try again shortly.'
      case 'config':
        return 'AI service is temporarily unavailable. Please try again later.'
      case 'too_large':
        return 'This material is too large for the AI to process at once. Try a shorter material or fewer questions.'
      case 'parse':
        return 'Could not process the AI response. Please try again.'
      // `unknown` and any future code fall through to the generic message —
      // never surface the raw provider text (e.g. Groq's "Request too large
      // for model openai/gpt-oss-120b … TPM …") to the user.
      default:
        return 'The AI service ran into a problem. Please try again.'
    }
  }
  return 'An unexpected AI error occurred. Please try again.'
}
