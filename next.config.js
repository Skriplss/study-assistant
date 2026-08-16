const isDev = process.env.NODE_ENV !== 'production'

// The Supabase host is the one third party the browser talks to (REST, auth,
// direct storage uploads). Everything else — fonts via next/font, katex CSS, the
// AI providers — is either self-hosted or called server-side.
const supabaseOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin
  : ''

/**
 * The value worth having here is `connect-src`: the Supabase session lives in a
 * JS-readable cookie (that is how AuthGuard forwards it to /api/auth/sync-session),
 * so an XSS would otherwise be free to POST it anywhere. Pinning the outbound
 * hosts is what makes stealing it awkward.
 *
 * `script-src` still needs 'unsafe-inline': the theme script in app/layout.tsx and
 * Next's own streaming bootstrap are inline, and nonces would force every page to
 * render dynamically (they have to be read per request), costing the static
 * prerender the login page currently gets. Honest trade-off, not an oversight.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseOrigin}`.trim(),
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
]
  .join('; ')
  .concat(isDev ? '' : '; upgrade-insecure-requests')

/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          // frame-ancestors already covers framing for modern browsers; this is
          // the same rule for anything that only understands the old header.
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=()',
          },
        ],
      },
    ]
  },

  // Performance optimizations
  compress: true, // Enable gzip compression

  // Image optimization
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60,
  },

  // Production optimizations
  productionBrowserSourceMaps: false, // Disable source maps in production

  // React optimizations
  reactStrictMode: true,

  // Turbopack configuration (Next.js 16+)
  turbopack: {
    rules: {
      // Externalize large dependencies for server-side
      '*.node': {
        loaders: ['ignore-loader'],
      },
    },
  },

  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
    // Optimize package imports
    optimizePackageImports: ['react-force-graph-2d', 'recharts', 'groq-sdk'],
    // Increase proxy (ex-middleware) body size limit
    proxyClientMaxBodySize: '100mb',
  },
}

module.exports = nextConfig
