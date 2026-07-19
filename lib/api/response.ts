import { NextResponse } from 'next/server'
import { AIServiceError, AI_ERROR_STATUS, getUserFriendlyAIError } from '@/lib/ai/errors'
import { ApiError } from '@/lib/api/errors'

/**
 * Turn any thrown error into a safe JSON error response.
 *
 * The rule: only errors we deliberately marked user-facing reach the client
 * verbatim — `AIServiceError` (mapped to a friendly message), `ApiError`, and
 * `MaterialValidationError`. Everything else (Supabase errors, provider text,
 * unexpected exceptions) is logged server-side and replaced with `fallback`, so
 * raw internals never leak to users.
 *
 * @param error   the caught value
 * @param fallback message shown when the error isn't a recognized user-facing one
 * @param fallbackStatus status paired with `fallback`
 */
export function errorResponse(
  error: unknown,
  fallback = 'Something went wrong. Please try again.',
  fallbackStatus = 500
): NextResponse {
  if (error instanceof AIServiceError) {
    const body: { error: string; code: string; retryAfter?: number } = {
      error: getUserFriendlyAIError(error),
      code: error.code,
    }
    if (error.retryAfterSeconds) body.retryAfter = error.retryAfterSeconds
    return NextResponse.json(body, { status: AI_ERROR_STATUS[error.code] })
  }

  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }

  // MaterialValidationError is user-facing bad-input; match by name to avoid
  // importing MaterialService (and its deps) into every route's error path.
  if (error instanceof Error && error.name === 'MaterialValidationError') {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  console.error('Unhandled API error:', error)
  return NextResponse.json({ error: fallback }, { status: fallbackStatus })
}
