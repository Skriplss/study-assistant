import AuthGuard from '@/components/auth/AuthGuard'
import DashboardNav from '@/components/dashboard/DashboardNav'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-background">
        <DashboardNav />
        <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
      </div>
    </AuthGuard>
  )
}
