'use client'

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react'

type Theme = 'light' | 'dark'

interface ThemeContextType {
  theme: Theme
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

// The blocking script in app/layout.tsx applies the stored theme class before
// first paint; this provider only mirrors it into React state for the toggle.
// It must always render the Provider — an earlier version returned a bare
// Fragment until mounted, and the Fragment→Provider type swap remounted the
// entire app subtree right after hydration.
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light')

  useEffect(() => {
    // Adopt whatever the pre-paint script decided instead of re-deriving it —
    // re-deriving here would clobber the class during the mount render.
    setTheme(
      document.documentElement.classList.contains('dark') ? 'dark' : 'light'
    )
  }, [])

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light'
    const root = document.documentElement
    root.classList.remove('light', 'dark')
    root.classList.add(next)
    localStorage.setItem('theme', next)
    setTheme(next)
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return context
}
