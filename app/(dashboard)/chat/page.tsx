import { Suspense } from 'react'
import { GlobalChat } from '@/components/chat/GlobalChat'

export default function ChatPage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-4">
        <h2 className="text-2xl font-bold">Chat</h2>
        <p className="text-sm text-muted-foreground">
          Ask questions across all your materials, or narrow to one.
        </p>
      </div>
      <Suspense
        fallback={<div className="text-muted-foreground">Loading…</div>}
      >
        <GlobalChat />
      </Suspense>
    </div>
  )
}
