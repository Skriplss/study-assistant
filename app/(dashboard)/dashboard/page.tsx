import Link from 'next/link'
import DueReviewsBanner from '@/components/review/DueReviewsBanner'
// Deferred through a client wrapper — `dynamic()` called from this Server
// Component could not use `ssr: false`, so recharts shipped in the first paint.
import AnalyticsDashboard from '@/components/analytics/LazyAnalyticsDashboard'

export default function DashboardPage() {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Welcome back</h1>
        <p className="mt-2 max-w-xl text-muted-foreground">
          Upload study materials, organize them with tags and categories, and
          generate AI-powered quizzes once your files are parsed.
        </p>
      </div>

      <DueReviewsBanner />

      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          href="/materials"
          className="rounded-lg bg-primary px-5 py-2.5 text-center text-sm font-semibold text-primary-foreground shadow-md transition-all hover:bg-primary/90"
        >
          View materials
        </Link>
        <Link
          href="/materials/upload"
          className="rounded-lg border-2 border-border bg-card px-5 py-2.5 text-center text-sm font-medium text-foreground transition-all hover:bg-accent"
        >
          Upload new file
        </Link>
        <Link
          href="/graph"
          className="rounded-lg border-2 border-border bg-card px-5 py-2.5 text-center text-sm font-medium text-foreground transition-all hover:bg-accent"
        >
          Knowledge Graph
        </Link>
      </div>

      <AnalyticsDashboard />
    </div>
  )
}
