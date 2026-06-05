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
        <main className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8 flex-1">{children}</main>
        <Footer />
      </div>
    </AuthGuard>
  )
}
