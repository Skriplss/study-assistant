'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { signOut, useAuth } from '@/lib/auth/session'
import { isAdmin } from '@/lib/config/admin'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { cn } from '@/lib/utils/cn'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/materials', label: 'Materials' },
  { href: '/graph', label: 'Graph' },
  { href: '/chat', label: 'Chat' },
]

export default function DashboardNav() {
  const pathname = usePathname()
  const router = useRouter()
  const { user } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)

  const navItems = isAdmin(user?.email)
    ? [...NAV_ITEMS, { href: '/feedback', label: 'Feedback' }]
    : NAV_ITEMS

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    await signOut()
    router.push('/auth/login')
    router.refresh()
  }

  const linkClass = (href: string) =>
    cn(
      'rounded-lg px-4 py-2 text-sm font-medium transition-all',
      pathname === href
        ? 'bg-primary text-primary-foreground shadow-md'
        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
    )

  return (
    <header className="border-b border-border bg-card shadow-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4">
        <Link
          href="/dashboard"
          className="text-xl font-bold text-foreground hover:text-primary transition-colors"
        >
          AI Study Assistant
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex gap-1">
          {navItems.map(item => (
            <Link key={item.href} href={item.href} className={linkClass(item.href)}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <button
            type="button"
            onClick={handleLogout}
            className="hidden md:inline text-sm font-medium text-muted-foreground hover:text-destructive transition-colors"
          >
            Log out
          </button>

          {/* Mobile hamburger */}
          <button
            type="button"
            onClick={() => setMenuOpen(o => !o)}
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
            className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-lg text-foreground hover:bg-accent"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              {menuOpen ? (
                <path d="M6 6l12 12M6 18L18 6" />
              ) : (
                <path d="M4 7h16M4 12h16M4 17h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {menuOpen && (
        <nav className="md:hidden border-t border-border px-4 py-3 flex flex-col gap-1">
          {navItems.map(item => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMenuOpen(false)}
              className={linkClass(item.href)}
            >
              {item.label}
            </Link>
          ))}
          <button
            type="button"
            onClick={handleLogout}
            className="mt-1 rounded-lg px-4 py-2 text-left text-sm font-medium text-muted-foreground hover:bg-accent hover:text-destructive transition-colors"
          >
            Log out
          </button>
        </nav>
      )}
    </header>
  )
}
