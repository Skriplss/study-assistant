'use client'

import { useRef, useState } from 'react'
import { useToast } from '@/components/ui/Toast'

interface Flyer {
  id: number
  bottom: string
  delay: number
  duration: number
  size: number
  emoji: string
}

const STAMPEDE_AT = 7

export function SheepEasterEgg() {
  const { toast } = useToast()
  const [flyers, setFlyers] = useState<Flyer[]>([])
  const [hop, setHop] = useState(false)
  const clicks = useRef(0)
  const idRef = useRef(0)

  const spawn = (count: number, herd: boolean) => {
    const batch: Flyer[] = Array.from({ length: count }, () => {
      const id = (idRef.current += 1)
      return {
        id,
        bottom: `${8 + Math.random() * 60}%`,
        delay: herd ? Math.random() * 1.2 : 0,
        duration: 2.2 + Math.random() * 1.6,
        size: 1 + Math.random() * (herd ? 0.7 : 0.3),
        emoji: herd && Math.random() < 0.15 ? '🐏' : '🐑',
      }
    })
    setFlyers(prev => [...prev, ...batch])
    const ids = new Set(batch.map(b => b.id))
    setTimeout(() => setFlyers(prev => prev.filter(f => !ids.has(f.id))), 5600)
  }

  const handleClick = () => {
    setHop(true)
    setTimeout(() => setHop(false), 400)

    clicks.current += 1
    if (clicks.current >= STAMPEDE_AT) {
      clicks.current = 0
      spawn(14, true)
      toast({ message: '🐑 You found the secret flock! Keep studying, you legend.', duration: 5000 })
    } else {
      spawn(1, false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        aria-label="A friendly sheep — click me"
        title="baa"
        className="text-base leading-none rounded transition-transform hover:scale-125 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        style={hop ? { animation: 'sheep-hop 0.4s ease' } : undefined}
      >
        🐑
      </button>

      {flyers.length > 0 && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          {flyers.map(f => (
            <span
              key={f.id}
              className="absolute left-0"
              style={{
                bottom: f.bottom,
                fontSize: `${f.size}rem`,
                animation: `sheep-run ${f.duration}s linear ${f.delay}s both`,
              }}
            >
              {f.emoji}
            </span>
          ))}
        </div>
      )}
    </>
  )
}
