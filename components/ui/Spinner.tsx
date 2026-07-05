import { cn } from '@/lib/utils/cn'

type SpinnerSize = 'sm' | 'md' | 'lg'

const SIZES: Record<SpinnerSize, string> = {
  sm: 'h-4 w-4 border-2',
  md: 'h-8 w-8 border-[3px]',
  lg: 'h-12 w-12 border-4',
}

interface SpinnerProps {
  size?: SpinnerSize
  /** Override color via text color, e.g. "text-primary". Defaults to currentColor. */
  className?: string
  label?: string
}

/**
 * Token-agnostic spinner. Uses `border-current`, so its color follows the
 * surrounding text color (`text-primary` standalone, button text inside a Button).
 */
export function Spinner({ size = 'md', className, label = 'Loading' }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label={label}
      className={cn(
        'inline-block animate-spin rounded-full border-solid border-current border-r-transparent align-[-0.125em]',
        SIZES[size],
        className
      )}
    />
  )
}
