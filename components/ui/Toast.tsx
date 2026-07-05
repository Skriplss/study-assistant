'use client'

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

export type ToastVariant = 'default' | 'success' | 'error'

interface ToastItem {
  id: number
  message: string
  variant: ToastVariant
}

interface ToastInput {
  message: string
  variant?: ToastVariant
  duration?: number
}

interface ToastContextValue {
  toast: (input: ToastInput | string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within a ToastProvider')
  return ctx
}

const VARIANT_STYLES: Record<ToastVariant, string> = {
  default: 'border-border',
  success: 'border-green-500/50',
  error: 'border-destructive/50',
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const idRef = useRef(0)

  const remove = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const toast = useCallback(
    (input: ToastInput | string) => {
      const normalized: ToastInput = typeof input === 'string' ? { message: input } : input
      const { message, variant = 'default', duration = 4000 } = normalized
      const id = (idRef.current += 1)
      setToasts(prev => [...prev, { id, message, variant }])
      setTimeout(() => remove(id), duration)
    },
    [remove]
  )

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2">
        {toasts.map(t => (
          <div
            key={t.id}
            role="status"
            className={cn(
              'pointer-events-auto flex items-start justify-between gap-3 rounded-lg border bg-card px-4 py-3 text-foreground shadow-lg',
              VARIANT_STYLES[t.variant]
            )}
          >
            <p className="text-sm">{t.message}</p>
            <button
              onClick={() => remove(t.id)}
              aria-label="Dismiss"
              className="text-muted-foreground hover:text-foreground text-lg leading-none"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
