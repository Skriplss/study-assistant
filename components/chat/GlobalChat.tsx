'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/auth/session'
import { fetchWithAuth } from '@/lib/api/fetch-with-auth'
import type { StudyMaterial } from '@/lib/types'

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
  const [materials, setMaterials] = useState<Pick<StudyMaterial, 'id' | 'title'>[]>([])
  const [scope, setScope] = useState<string>(searchParams.get('material') || 'all')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  // Load the material list for the scope selector.
  useEffect(() => {
    if (!session) return
    ;(async () => {
      try {
        const res = await fetchWithAuth(session, '/api/materials')
        const data = await res.json()
        if (res.ok) setMaterials((data.materials ?? []).map((m: StudyMaterial) => ({ id: m.id, title: m.title })))
      } catch {
        /* non-fatal — scope just falls back to "all" */
      }
    })()
  }, [session])

  const send = async (text: string) => {
    const userMessage = text.trim()
    if (!userMessage || loading || !session) return

    const history = messages.map(({ role, content }) => ({ role, content })).slice(-10)
    const base: Message[] = [...messages, { role: 'user', content: userMessage }]
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
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setMessages([...base, { role: 'assistant', content: err.error || 'Something went wrong.' }])
        return
      }

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
        setMessages([...base, { role: 'assistant', content: fallback, sources }])
        return
      }

      const decoder = new TextDecoder()
      let acc = ''
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        acc += decoder.decode(value, { stream: true })
        setMessages([...base, { role: 'assistant', content: acc, sources }])
      }
    } catch {
      setMessages([...base, { role: 'assistant', content: 'Failed to get a response.' }])
    } finally {
      setLoading(false)
    }
  }

  const lastAssistant = messages[messages.length - 1]?.role === 'assistant'
  const streaming = loading && lastAssistant
  const scopeTitle = scope === 'all' ? null : materials.find(m => m.id === scope)?.title

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)] min-h-[480px]">
      <div className="mb-3 flex items-center gap-2">
        <label htmlFor="chat-scope" className="text-sm text-muted-foreground shrink-0">
          Scope
        </label>
        <select
          id="chat-scope"
          value={scope}
          onChange={e => setScope(e.target.value)}
          className="flex-1 max-w-xs px-3 py-1.5 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="all">All materials</option>
          {materials.map(m => (
            <option key={m.id} value={m.id}>
              {m.title}
            </option>
          ))}
        </select>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 pr-1">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center gap-4">
            <p className="text-muted-foreground">
              {scopeTitle
                ? `Ask anything about “${scopeTitle}”.`
                : 'Ask anything about your uploaded materials — answers cite the sources they came from.'}
            </p>
            {!scopeTitle && (
              <div className="flex flex-wrap justify-center gap-2 max-w-xl">
                {SUGGESTIONS.map(s => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="px-3 py-1.5 text-sm rounded-full border border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-card border border-border text-foreground'
                }`}
              >
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>
                {msg.role === 'assistant' && msg.sources && msg.sources.length > 0 && (
                  <div className="mt-3 pt-2 border-t border-border flex flex-wrap gap-1.5">
                    <span className="text-xs text-muted-foreground mr-1">Sources:</span>
                    {msg.sources.map(src => (
                      <Link
                        key={src.id}
                        href={`/materials/${src.id}`}
                        className="px-2 py-0.5 text-xs rounded-full bg-blue-500/10 text-blue-500 hover:underline max-w-[16rem] truncate"
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
            <div className="bg-card border border-border rounded-2xl px-4 py-2.5">
              <span className="text-sm text-muted-foreground animate-pulse">Thinking…</span>
            </div>
          </div>
        )}
      </div>

      <form
        onSubmit={e => {
          e.preventDefault()
          send(input)
        }}
        className="mt-4 flex gap-2"
      >
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={scopeTitle ? `Ask about “${scopeTitle}”…` : 'Ask about your materials…'}
          disabled={loading}
          className="flex-1 px-4 py-2.5 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          Send
        </button>
      </form>
    </div>
  )
}
