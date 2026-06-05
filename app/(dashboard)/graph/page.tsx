'use client'

import dynamic from 'next/dynamic'

const KnowledgeGraphViewer = dynamic(
  () => import('@/components/graph/KnowledgeGraphViewer').then(mod => ({ default: mod.KnowledgeGraphViewer })),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
          <p className="mt-4 text-muted-foreground">Loading graph...</p>
        </div>
      </div>
    ),
  }
)

export default function GraphPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <KnowledgeGraphViewer />
    </div>
  )
}
