'use client'

import { StudyMaterial } from '@/lib/types'

interface ParsingStatusProps {
  material: StudyMaterial
}

export default function ParsingStatus({ material }: ParsingStatusProps) {
  const { parsingStatus, parsingError } = material

  const statusConfig = {
    pending: {
      icon: '⏳',
      label: 'Pending',
      description: 'Waiting to be processed',
      className: 'bg-muted text-muted-foreground',
    },
    processing: {
      icon: '⚙️',
      label: 'Processing',
      description: 'Extracting text content...',
      className: 'bg-primary/10 text-primary',
    },
    completed: {
      icon: '✓',
      label: 'Completed',
      description: 'Text extracted successfully',
      className: 'bg-green-500/10 text-green-600 dark:text-green-400',
    },
    failed: {
      icon: '✕',
      label: 'Failed',
      description: parsingError || 'Parsing failed',
      className: 'bg-destructive/10 text-destructive',
    },
  }

  const config = statusConfig[parsingStatus]

  return (
    <div className={`rounded px-2 py-1 text-xs font-medium inline-flex items-center gap-1.5 ${config.className}`}>
      <span>{config.icon}</span>
      <span>{config.label}</span>
      {parsingStatus === 'processing' && (
        <div className="animate-spin h-3 w-3 border-2 border-current border-t-transparent rounded-full" />
      )}
    </div>
  )
}
