import SignupForm from '@/components/auth/SignupForm'

export default function SignupPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8 relative">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-foreground mb-3 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            AI Study Assistant
          </h1>
          <p className="text-muted-foreground text-lg">Create your account</p>
        </div>
        <div className="bg-card p-10 rounded-2xl shadow-2xl border border-border">
          <SignupForm />
        </div>
      </div>
    </div>
  )
}
