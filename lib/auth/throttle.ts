import 'server-only'

import type { NextRequest } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'

/**
 * Rate limiting for the auth endpoints, counted in Postgres.
 *
 * See supabase/migrations/add_auth_throttle.sql for why it is not in memory and
 * why Supabase's own limiter doesn't cover us here.
 */

export interface ThrottleRule {
  /** Attempts allowed inside `windowMinutes` before the block kicks in. */
  limit: number
  windowMinutes: number
  blockMinutes: number
}

/** Sign-in. Ten wrong passwords in fifteen minutes is already nothing a person does. */
export const LOGIN_RULE: ThrottleRule = {
  limit: 10,
  windowMinutes: 15,
  blockMinutes: 15,
}

/** Account creation and password-reset mail: rarer actions, tighter budget. */
export const SIGNUP_RULE: ThrottleRule = {
  limit: 5,
  windowMinutes: 60,
  blockMinutes: 60,
}

/**
 * The caller's address.
 *
 * `x-forwarded-for` is client-writable in general, so the platform headers come
 * first — Vercel sets those itself. The IP key is best-effort by nature (an
 * attacker with a spoofable path just spreads out); the email key is the one that
 * actually protects an account, and that one can't be rotated.
 */
export function clientIp(request: NextRequest): string {
  const platform =
    request.headers.get('x-vercel-forwarded-for') ??
    request.headers.get('x-real-ip')
  if (platform) return platform.trim()

  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()

  return 'unknown'
}

/**
 * Count an attempt against each key. Returns the seconds to wait when the caller
 * is over the limit, or null when they may proceed.
 *
 * Fails OPEN: if the counter itself is broken (or its migration hasn't been
 * applied yet), sign-in keeps working and the failure is logged. The alternative
 * — a database hiccup locking every user out of the app — is the worse outcome,
 * but it does mean a silent log here means silently no protection.
 */
export async function registerAttempt(
  keys: string[],
  rule: ThrottleRule
): Promise<number | null> {
  try {
    const { data, error } = await getSupabaseAdmin().rpc(
      'register_auth_attempt',
      {
        p_keys: keys,
        p_limit: rule.limit,
        p_window: `${rule.windowMinutes} minutes`,
        p_block: `${rule.blockMinutes} minutes`,
      }
    )

    if (error) {
      console.error(
        'Auth throttle unavailable — request allowed through:',
        error
      )
      return null
    }

    if (!data) return null

    const seconds = Math.ceil(
      (new Date(data as string).getTime() - Date.now()) / 1000
    )
    return seconds > 0 ? seconds : null
  } catch (error) {
    console.error('Auth throttle unavailable — request allowed through:', error)
    return null
  }
}

/** Wipe the counters for these keys after the credentials turn out to be right. */
export async function clearAttempts(keys: string[]): Promise<void> {
  try {
    await getSupabaseAdmin().rpc('clear_auth_attempts', { p_keys: keys })
  } catch (error) {
    console.error('Failed to clear auth attempts:', error)
  }
}

/**
 * Namespaced so a login counter and a reset counter can't collide on one email.
 *
 * Both parts are truncated: `email` is unvalidated request input at this point,
 * and the key is a TEXT primary key. A megabyte-long "email" would blow past the
 * btree row limit, the insert would fail, and — because this thing fails open —
 * the throttle would quietly stop applying to exactly the caller who sent it.
 */
export function attemptKeys(
  action: 'login' | 'signup' | 'reset',
  request: NextRequest,
  email?: string
): string[] {
  const keys = [`${action}:ip:${clientIp(request).slice(0, 64)}`]
  if (email) {
    keys.push(`${action}:email:${email.trim().toLowerCase().slice(0, 254)}`)
  }
  return keys
}

/** Just the email half — see the note where login clears its counter. */
export function emailKeyOnly(keys: string[]): string[] {
  return keys.filter((key) => key.includes(':email:'))
}
