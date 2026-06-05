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
      className: 'bg-gray-100 text-gray-800 border-gray-300',
    },
    processing: {
      icon: '⚙️',
      label: 'Processing',
      description: 'Extracting text content...',
      className: 'bg-blue-100 text-blue-800 border-blue-300',
    },
    completed: {
      icon: '✅',
      label: 'Completed',
      description: 'Text extracted successfully',
      className: 'bg-green-100 text-green-800 border-green-300',
    },
    failed: {
      icon: '❌',
      label: 'Failed',
      description: parsingError || 'Parsing failed',
      className: 'bg-red-100 text-red-800 border-red-300',
    },
  }

  const config = statusConfig[parsingStatus]

  return (
    <div className={`border rounded-lg p-4 ${config.className}`}>
      <div className="flex items-start gap-3">
        <span className="text-2xl">{config.icon}</span>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold">{config.label}</h3>
            {parsingStatus === 'processing' && (
              <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
            )}
          </div>
          <p className="text-sm">{config.description}</p>
        </div>
      </div>

      {parsingStatus === 'failed' && parsingError && (
        <div className="mt-3 pt-3 border-t border-current/20">
          <p className="text-sm font-medium">Error details:</p>
          <p className="text-sm mt-1 font-mono bg-white/50 p-2 rounded">
            {parsingError}
          </p>
        </div>
      )}
    </div>
  )
}
