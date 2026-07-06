'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/auth/session'
import { fetchWithAuth } from '@/lib/api/fetch-with-auth'
import { useToast } from '@/components/ui/Toast'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'

type FeedbackType = 'bug' | 'idea' | 'other'

const TYPES: { value: FeedbackType; label: string }[] = [
  { value: 'bug', label: '🐞 Bug' },
  { value: 'idea', label: '💡 Idea' },
  { value: 'other', label: '💬 Other' },
]

export function FeedbackButton() {
  const { session } = useAuth()
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<FeedbackType>('bug')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const close = () => {
    if (submitting) return
    setOpen(false)
  }

  const handleSubmit = async () => {
    if (!message.trim() || submitting || !session) return
    setSubmitting(true)
    try {
      const res = await fetchWithAuth(session, '/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          message,
          pageUrl: typeof window !== 'undefined' ? window.location.pathname : undefined,
        }),
      })
      if (!res.ok) throw new Error('failed')

      toast({ message: 'Thanks! Your report was sent 🙌', variant: 'success' })
      setMessage('')
      setType('bug')
      setOpen(false)
    } catch {
      toast({ message: 'Failed to send. Please try again.', variant: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.9 9.9 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        Support
      </button>

      <Modal open={open} onClose={close} title="Report a bug or share feedback" widthClass="max-w-lg">
        <div className="space-y-4">
          <div className="flex gap-2">
            {TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => setType(t.value)}
                className={`flex-1 px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                  type === t.value
                    ? 'border-primary bg-primary/10 text-foreground'
                    : 'border-border bg-card text-muted-foreground hover:border-primary/50'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            autoFocus
            placeholder={
              type === 'bug'
                ? 'What went wrong? What were you doing when it happened?'
                : 'Tell us what you have in mind…'
            }
            className="w-full p-3 border-2 border-border bg-background text-foreground rounded-lg focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
          />

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={close} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} loading={submitting} disabled={!message.trim()}>
              Send report
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
