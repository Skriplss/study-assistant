/**
 * An error whose message is safe to show the user verbatim, carrying the HTTP
 * status the route should return. Throw this for expected, user-facing failures
 * (not found, forbidden, bad input). Anything that is NOT an ApiError (Supabase
 * errors, provider gibberish, unexpected exceptions) is treated as internal by
 * `errorResponse` and replaced with a generic message — so never wrap a raw
 * database/provider message in one.
 *
 * Kept dependency-free (no `next/server`) so services can throw it without
 * pulling the Next runtime into unit tests.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number = 400
  ) {
    super(message)
    this.name = 'ApiError'
  }
}
