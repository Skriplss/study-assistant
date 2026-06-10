import AuthGuard from '@/components/auth/AuthGuard'
import DashboardNav from '@/components/dashboard/DashboardNav'
import { Footer } from '@/components/dashboard/Footer'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-background flex flex-col">
        <DashboardNav />
        <main className="flex-1">{children}</main>
        <Footer />
      </div>
    </AuthGuard>
  )
}
