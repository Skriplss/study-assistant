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

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

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

    // Get session from cookies
    const token = request.cookies.get('sb-access-token')?.value

    if (!token) {
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

    // Verify token
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token)

    if (error || !user) {
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

    // Add user ID to headers for API routes
    response.headers.set('x-user-id', user.id)
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
