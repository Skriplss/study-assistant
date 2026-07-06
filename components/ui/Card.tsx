import { type HTMLAttributes } from 'react'
import { cn } from '@/lib/utils/cn'

/** Panel surface bound to theme tokens. Add padding (e.g. `p-6`) at the call site. */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-lg border border-border bg-card', className)} {...props} />
}
