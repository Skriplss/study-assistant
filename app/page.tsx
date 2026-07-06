import Link from 'next/link'
import { buttonVariants } from '@/components/ui/Button'

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-24">
      <h1 className="font-serif text-5xl leading-[1.05] text-foreground sm:text-6xl">
        Study Assistant
      </h1>
      <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
        Drop in your notes, PDFs, lectures, or a YouTube link. Get quizzes drawn
        straight from them, a knowledge graph of how the ideas connect, and a
        tutor that has actually read your material.
      </p>
      <div className="mt-10 flex gap-3">
        <Link href="/auth/login" className={buttonVariants({ size: 'lg' })}>
          Log in
        </Link>
        <Link href="/auth/signup" className={buttonVariants({ variant: 'outline', size: 'lg' })}>
          Create account
        </Link>
      </div>
    </main>
  )
}
