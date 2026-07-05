import { SheepEasterEgg } from './SheepEasterEgg'

export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="relative overflow-hidden w-full border-t border-border bg-card/50 backdrop-blur-sm mt-auto">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-3">
          <div className="flex flex-col sm:flex-row items-center gap-3 text-xs text-muted-foreground">
            <p>© {currentYear} AI Study Assistant</p>
            <span className="hidden sm:inline text-muted-foreground/50">•</span>
            <p>Organize and engage with study materials using AI</p>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Built for</span>
            <SheepEasterEgg />
          </div>
        </div>
      </div>
    </footer>
  )
}
