/** @type {import('next').NextConfig} */
const nextConfig = {
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
