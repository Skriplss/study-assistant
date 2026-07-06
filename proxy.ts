import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Protected routes that require authentication
const protectedRoutes = [
  '/dashboard',
  '/materials',
  '/quizzes',
  '/knowledge-graph',
  '/analytics',
  '/api/materials',
  '/api/tags',
  '/api/categories',
  '/api/quizzes',
  '/api/graph',
  '/api/analytics',
]

// Public routes that don't require authentication
const publicRoutes = [
  '/',
  '/auth/login',
  '/auth/signup',
  '/auth/reset-password',
  '/api/auth',
]

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Root is just an entry point — no marketing splash. Send people straight to
  // where they belong: the app if signed in, the login screen otherwise.
  if (pathname === '/') {
    const accessToken = request.cookies.get('sb-access-token')?.value
    const refreshToken = request.cookies.get('sb-refresh-token')?.value
    let authed = false
    if (accessToken) {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } }
      )
      const { data } = await supabase.auth.getUser(accessToken)
      authed = !!data.user
    }
    if (!authed && refreshToken) authed = true
    return NextResponse.redirect(new URL(authed ? '/dashboard' : '/auth/login', request.url))
  }

  // Check if the route is protected
  const isProtectedRoute = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  )

  const isPublicRoute = publicRoutes.some((route) =>
    pathname.startsWith(route)
  )

  // Allow public routes
  if (isPublicRoute && !isProtectedRoute) {
    return NextResponse.next()
  }

  // Check authentication for protected routes
  if (isProtectedRoute) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

    const response = NextResponse.next()
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    })

    const accessToken = request.cookies.get('sb-access-token')?.value
    const refreshToken = request.cookies.get('sb-refresh-token')?.value

    // 1) A present access token is verified against Supabase.
    let authed = false
    let userId: string | undefined
    if (accessToken) {
      const { data } = await supabase.auth.getUser(accessToken)
      if (data.user) {
        authed = true
        userId = data.user.id
      }
    }

    // 2) Access cookie missing/expired but the long-lived refresh cookie is
    //    present: let the request through. The short-lived (~1h) access cookie
    //    lapses well before the refresh token, and the browser client re-syncs
    //    it via /api/auth/sync-session. We deliberately do NOT refresh here —
    //    rotating the refresh token from the edge races the browser's own
    //    auto-refresh and can force a spurious logout. The real security
    //    boundary is each API route (which re-verifies the Bearer token) plus
    //    the client AuthGuard on UI routes.
    if (!authed && refreshToken) {
      authed = true
    }

    if (!authed) {
      // Redirect to login for UI routes
      if (!pathname.startsWith('/api')) {
        return NextResponse.redirect(new URL('/auth/login', request.url))
      }
      // Return 401 for API routes
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Add user ID to headers for API routes (best-effort; only when verified).
    if (userId) response.headers.set('x-user-id', userId)
    return response
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

// Increase body size limit to 100MB
export const maxDuration = 60
export const bodySizeLimit = '100mb'
