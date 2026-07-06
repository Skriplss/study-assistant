import SignupForm from '@/components/auth/SignupForm'

export default function SignupPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="font-serif text-4xl text-foreground mb-2">AI Study Assistant</h1>
          <p className="text-muted-foreground">Create your account</p>
        </div>
        <div className="bg-card p-8 rounded-lg border border-border">
          <SignupForm />
        </div>
      </div>
    </div>
  )
}
