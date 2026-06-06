/** @type {import('next').NextConfig} */
const nextConfig = {
  // Performance optimizations
  compress: true, // Enable gzip compression
  
  // Output configuration for Netlify
  output: 'standalone',
  
  // Image optimization
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60,
  },

  // Production optimizations
  productionBrowserSourceMaps: false, // Disable source maps in production
  
  // React optimizations
  reactStrictMode: true,
  
  // Webpack optimizations to reduce bundle size
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Externalize large dependencies to reduce function size
      config.externals = [
        ...config.externals,
        'canvas',
        'jsdom',
      ]
    }
    
    return config
  },
  
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
    // Optimize package imports
    optimizePackageImports: ['reactflow', '@xyflow/react', 'recharts', 'groq-sdk'],
  },

  // Headers for caching
  async headers() {
    return [
      {
        source: '/:all*(svg|jpg|png|webp|avif)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ]
  },
}

module.exports = nextConfig
