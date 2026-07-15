import LoginForm from '@/components/auth/LoginForm'

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-semibold text-foreground mb-2">AI Study Assistant</h1>
          <p className="text-muted-foreground">Log in to your account</p>
        </div>
        <div className="bg-card p-8 rounded-lg border border-border">
          <LoginForm />
        </div>
      </div>
    </div>
  )
}
