'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/auth/session'
import { fetchWithAuth } from '@/lib/api/fetch-with-auth'
import type {
  ChatMessageRecord,
  ConversationSummary,
  StudyMaterial,
} from '@/lib/types'
import { cn } from '@/lib/utils/cn'

interface Source {
  id: string
  title: string
}

interface Message {
  role: 'user' | 'assistant'
  content: string
  sources?: Source[]
}

const SUGGESTIONS = [
  'Summarize the key ideas across my materials',
  'How do my materials connect to each other?',
  'Quiz me on the main concepts',
]

export function GlobalChat() {
  const { session } = useAuth()
  const searchParams = useSearchParams()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [materials, setMaterials] = useState<
    Pick<StudyMaterial, 'id' | 'title'>[]
  >([])
  const [scope, setScope] = useState<string>(
    searchParams.get('material') || 'all'
  )
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  // Bumped whenever the user switches threads; an in-flight send() compares
  // against its own snapshot and stops touching state once it's stale, so a
  // streaming response can't overwrite the thread the user navigated to.
  const threadSeq = useRef(0)

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    })
  }, [messages])

  // Load the material list for the scope selector.
  useEffect(() => {
    if (!session) return
    ;(async () => {
      try {
        const res = await fetchWithAuth(session, '/api/materials')
        const data = await res.json()
        if (res.ok)
          setMaterials(
            (data.materials ?? []).map((m: StudyMaterial) => ({
              id: m.id,
              title: m.title,
            }))
          )
      } catch {
        /* non-fatal — scope just falls back to "all" */
      }
    })()
  }, [session])

  const loadConversations = useCallback(async () => {
    if (!session) return
    try {
      const res = await fetchWithAuth(session, '/api/conversations')
      const data = await res.json()
      if (res.ok) setConversations(data.conversations ?? [])
    } catch {
      /* non-fatal — the sidebar just stays empty */
    }
  }, [session])

  useEffect(() => {
    loadConversations()
  }, [loadConversations])

  const openConversation = async (id: string) => {
    if (!session) return
    setHistoryOpen(false)

    try {
      const res = await fetchWithAuth(session, `/api/conversations/${id}`)
      const data = await res.json()
      if (!res.ok) return

      threadSeq.current += 1
      setConversationId(id)
      setMessages(
        (data.messages ?? []).map((m: ChatMessageRecord) => ({
          role: m.role,
          content: m.content,
          sources: m.sources ?? undefined,
        }))
      )
      // Restore the scope the conversation was started with, so follow-ups keep
      // drawing on the same material.
      const summary = conversations.find((c) => c.id === id)
      setScope(summary?.materialId ?? 'all')
    } catch {
      /* non-fatal — leave the current thread in place */
    }
  }

  const startNew = () => {
    threadSeq.current += 1
    setConversationId(null)
    setMessages([])
    setInput('')
    setHistoryOpen(false)
  }

  const deleteConversation = async (id: string) => {
    if (!session) return
    if (!confirm('Delete this conversation? This cannot be undone.')) return

    try {
      const res = await fetchWithAuth(session, `/api/conversations/${id}`, {
        method: 'DELETE',
      })
      if (!res.ok) return
      setConversations((prev) => prev.filter((c) => c.id !== id))
      if (conversationId === id) startNew()
    } catch {
      /* non-fatal */
    }
  }

  const send = async (text: string) => {
    const userMessage = text.trim()
    if (!userMessage || loading || !session) return

    const history = messages
      .map(({ role, content }) => ({ role, content }))
      .slice(-10)
    const base: Message[] = [
      ...messages,
      { role: 'user', content: userMessage },
    ]
    const seq = threadSeq.current
    const stale = () => threadSeq.current !== seq
    setMessages(base)
    setInput('')
    setLoading(true)

    try {
      const res = await fetchWithAuth(session, '/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          history,
          materialId: scope === 'all' ? undefined : scope,
          conversationId: conversationId ?? undefined,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        if (!stale())
          setMessages([
            ...base,
            {
              role: 'assistant',
              content: err.error || 'Something went wrong.',
            },
          ])
        return
      }

      // The server opens a conversation on the first message and reports the id
      // here — the body is a stream and can't carry it.
      const newId = res.headers.get('X-Conversation-Id')
      const isFirstTurn = !conversationId
      if (newId && !conversationId && !stale()) setConversationId(newId)

      let sources: Source[] = []
      const header = res.headers.get('X-Chat-Sources')
      if (header) {
        try {
          sources = JSON.parse(decodeURIComponent(header))
        } catch {
          /* ignore malformed header */
        }
      }

      const reader = res.body?.getReader()
      if (!reader) {
        const fallback = await res.text()
        if (!stale())
          setMessages([
            ...base,
            { role: 'assistant', content: fallback, sources },
          ])
        return
      }

      const decoder = new TextDecoder()
      let acc = ''
      for (;;) {
        if (stale()) {
          // User switched threads mid-stream; the server still finishes
          // writing the turn, so it's there when they come back.
          reader.cancel().catch(() => {})
          break
        }
        const { done, value } = await reader.read()
        if (done) break
        acc += decoder.decode(value, { stream: true })
        if (!stale())
          setMessages([...base, { role: 'assistant', content: acc, sources }])
      }

      // Refresh once the turn is written so the sidebar shows the new thread
      // (and re-sorts existing ones by activity).
      if (isFirstTurn) loadConversations()
    } catch {
      if (!stale())
        setMessages([
          ...base,
          { role: 'assistant', content: 'Failed to get a response.' },
        ])
    } finally {
      setLoading(false)
    }
  }

  const lastAssistant = messages[messages.length - 1]?.role === 'assistant'
  const streaming = loading && lastAssistant
  const scopeTitle =
    scope === 'all' ? null : materials.find((m) => m.id === scope)?.title

  return (
    <div className="flex h-[calc(100vh-12rem)] min-h-[480px] gap-4">
      {/* Conversation history — a drawer on mobile, a rail on desktop. */}
      <aside
        className={cn(
          'w-56 shrink-0 flex-col gap-2 overflow-y-auto border-r border-border pr-3',
          historyOpen
            ? 'absolute inset-x-4 bottom-4 top-32 z-20 flex w-auto rounded-lg border border-r-0 bg-card p-3 shadow-xl'
            : 'hidden md:flex'
        )}
      >
        <button
          type="button"
          onClick={startNew}
          className="w-full rounded-lg border border-border px-3 py-2 text-sm font-medium transition-colors hover:bg-accent"
        >
          + New chat
        </button>

        {conversations.length === 0 ? (
          <p className="px-1 py-2 text-xs text-muted-foreground">
            No saved chats yet.
          </p>
        ) : (
          conversations.map((c) => (
            <div
              key={c.id}
              className={cn(
                'group flex items-center gap-1 rounded-lg transition-colors',
                conversationId === c.id ? 'bg-primary/10' : 'hover:bg-accent'
              )}
            >
              <button
                type="button"
                onClick={() => openConversation(c.id)}
                className="min-w-0 flex-1 px-2.5 py-2 text-left"
              >
                <span className="block truncate text-xs font-medium text-foreground">
                  {c.title}
                </span>
                <span className="block truncate text-[10px] text-muted-foreground">
                  {new Date(c.updatedAt).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                  })}
                  {c.materialId && ' · scoped'}
                </span>
              </button>
              <button
                type="button"
                onClick={() => deleteConversation(c.id)}
                aria-label={`Delete ${c.title}`}
                className="px-2 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
              >
                ×
              </button>
            </div>
          ))
        )}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="mb-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setHistoryOpen((o) => !o)}
            aria-expanded={historyOpen}
            className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-accent md:hidden"
          >
            Chats
          </button>
          <label
            htmlFor="chat-scope"
            className="hidden shrink-0 text-sm text-muted-foreground sm:block"
          >
            Scope
          </label>
          <select
            id="chat-scope"
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            className="max-w-xs flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">All materials</option>
            {materials.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title}
              </option>
            ))}
          </select>
        </div>

        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto pr-1">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
              <p className="text-muted-foreground">
                {scopeTitle
                  ? `Ask anything about “${scopeTitle}”.`
                  : 'Ask anything about your uploaded materials — answers cite the sources they came from.'}
              </p>
              {!scopeTitle && (
                <div className="flex max-w-xl flex-wrap justify-center gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="rounded-full border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'border border-border bg-card text-foreground'
                  }`}
                >
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">
                    {msg.content}
                  </p>
                  {msg.role === 'assistant' &&
                    msg.sources &&
                    msg.sources.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border pt-2">
                        <span className="mr-1 text-xs text-muted-foreground">
                          Sources:
                        </span>
                        {msg.sources.map((src) => (
                          <Link
                            key={src.id}
                            href={`/materials/${src.id}`}
                            className="max-w-[16rem] truncate rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary hover:underline"
                            title={src.title}
                          >
                            {src.title}
                          </Link>
                        ))}
                      </div>
                    )}
                </div>
              </div>
            ))
          )}
          {loading && !streaming && (
            <div className="flex justify-start">
              <div className="rounded-2xl border border-border bg-card px-4 py-2.5">
                <span className="animate-pulse text-sm text-muted-foreground">
                  Thinking…
                </span>
              </div>
            </div>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            send(input)
          }}
          className="mt-4 flex gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              scopeTitle
                ? `Ask about “${scopeTitle}”…`
                : 'Ask about your materials…'
            }
            disabled={loading}
            className="flex-1 rounded-lg border border-border bg-background px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="rounded-lg bg-primary px-5 py-2.5 font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  )
}
