'use client'

import dynamic from 'next/dynamic'

/**
 * Client-side wrapper so recharts is genuinely deferred.
 *
 * The dashboard page called `dynamic()` directly, but it is a Server Component —
 * `ssr: false` is not available there, so the chunk was rendered on the server
 * and preloaded into the first paint. recharts is 102KB gzipped, and it showed:
 * /dashboard shipped 349KB against a 234KB baseline. The graph page has always
 * done it this way and force-graph is correctly absent from its HTML.
 */
const AnalyticsDashboard = dynamic(
  () =>
    import('@/components/analytics/AnalyticsDashboard').then((mod) => ({
      default: mod.AnalyticsDashboard,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="animate-pulse rounded-xl border border-border bg-card p-6"
          >
            <div className="mb-4 h-4 w-1/2 rounded bg-muted"></div>
            <div className="h-8 w-3/4 rounded bg-muted"></div>
          </div>
        ))}
      </div>
    ),
  }
)

export default AnalyticsDashboard
