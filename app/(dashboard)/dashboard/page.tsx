import Link from 'next/link'
import dynamic from 'next/dynamic'

const AnalyticsDashboard = dynamic(
  () => import('@/components/analytics/AnalyticsDashboard').then(mod => ({ default: mod.AnalyticsDashboard })),
  {
    loading: () => (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-card rounded-xl p-6 border border-border animate-pulse">
            <div className="h-4 bg-muted rounded w-1/2 mb-4"></div>
            <div className="h-8 bg-muted rounded w-3/4"></div>
          </div>
        ))}
      </div>
    ),
  }
)

export default function DashboardPage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Welcome back</h1>
        <p className="text-muted-foreground mt-2 max-w-xl">
          Upload study materials, organize them with tags and categories, and
          generate AI-powered quizzes once your files are parsed.
        </p>
      </div>
      
      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          href="/materials"
          className="px-5 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 text-sm font-semibold shadow-md transition-all text-center"
        >
          View materials
        </Link>
        <Link
          href="/materials/upload"
          className="px-5 py-2.5 border-2 border-border bg-card text-foreground rounded-lg hover:bg-accent text-sm font-medium transition-all text-center"
        >
          Upload new file
        </Link>
        <Link
          href="/graph"
          className="px-5 py-2.5 border-2 border-border bg-card text-foreground rounded-lg hover:bg-accent text-sm font-medium transition-all text-center"
        >
          Knowledge Graph
        </Link>
      </div>

      <AnalyticsDashboard />
    </div>
  )
}
