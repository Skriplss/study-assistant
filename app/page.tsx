import Link from 'next/link'
import { buttonVariants } from '@/components/ui/Button'

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold text-foreground">AI Study Assistant</h1>
      <p className="mt-4 text-lg text-muted-foreground text-center max-w-lg">
        Your intelligent companion for organizing and mastering study materials
      </p>
      <div className="mt-8 flex gap-4">
        <Link href="/auth/login" className={buttonVariants({ size: 'lg' })}>
          Log in
        </Link>
        <Link href="/auth/signup" className={buttonVariants({ variant: 'outline', size: 'lg' })}>
          Sign up
        </Link>
      </div>
    </main>
  )
}
