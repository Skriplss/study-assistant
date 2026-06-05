import LoginForm from '@/components/auth/LoginForm'
import { ThemeToggle } from '@/components/ui/ThemeToggle'

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 relative">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-foreground mb-3 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            AI Study Assistant
          </h1>
          <p className="text-muted-foreground text-lg">Login to your account</p>
        </div>
        <div className="bg-card p-10 rounded-2xl shadow-2xl border border-border">
          <LoginForm />
        </div>
      </div>
    </div>
  )
}
