'use client'

import { useRouter } from 'next/navigation'

// The policy is reachable both from signup (new tab) and from the dashboard
// footer — a hardcoded destination is wrong for one of them, so go back to
// wherever the reader came from.
export function BackLink() {
  const router = useRouter()
  return (
    <button
      type="button"
      onClick={() =>
        window.history.length > 1 ? router.back() : router.push('/')
      }
      className="text-primary hover:underline"
    >
      ← Back
    </button>
  )
}
