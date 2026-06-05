export type AIServiceErrorCode =
  | 'timeout'
  | 'rate_limit'
  | 'quota'
  | 'parse'
  | 'unavailable'
  | 'config'
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
        return 'AI service is temporarily unavailable.'
      case 'config':
        return 'AI service is not configured.'
      case 'parse':
        return 'Could not process the AI response. Please try again.'
      default:
        return error.message
    }
  }
  return 'An unexpected AI error occurred.'
}
