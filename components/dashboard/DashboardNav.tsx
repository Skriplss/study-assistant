'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { signOut } from '@/lib/auth/session'
import { ThemeToggle } from '@/components/ui/ThemeToggle'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/materials', label: 'Materials' },
  { href: '/materials/upload', label: 'Upload' },
  { href: '/graph', label: 'Graph' },
]

export default function DashboardNav() {
  const pathname = usePathname()
  const router = useRouter()

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    await signOut()
    router.push('/auth/login')
    router.refresh()
  }

  return (
    <header className="border-b border-border bg-card shadow-sm">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4">
        <Link href="/dashboard" className="text-xl font-bold text-foreground hover:text-primary transition-colors">
          AI Study Assistant
        </Link>
        <nav className="flex flex-wrap gap-1">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                  active
                    ? 'bg-primary text-primary-foreground shadow-md'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                }`}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <button
            type="button"
            onClick={handleLogout}
            className="text-sm font-medium text-muted-foreground hover:text-destructive transition-colors"
          >
            Log out
          </button>
        </div>
      </div>
    </header>
  )
}
