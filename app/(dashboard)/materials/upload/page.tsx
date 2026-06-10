'use client'

import { useRouter } from 'next/navigation'
import MaterialUploader from '@/components/materials/MaterialUploader'
import { fetchWithAuth } from '@/lib/api/fetch-with-auth'
import { useAuth } from '@/lib/auth/session'

export default function UploadMaterialPage() {
  const router = useRouter()
  const { session } = useAuth()

  const handleUploadComplete = async (materialId: string) => {
    if (session) {
      try {
        await fetchWithAuth(session, '/api/materials/parse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ materialId }),
        })
      } catch {
        // Parsing can be retried from the material detail view
      }
    }
    router.push(`/materials/${materialId}`)
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <h1 className="text-2xl font-bold text-center">Upload material</h1>
      <MaterialUploader onUploadComplete={handleUploadComplete} />
    </div>
  )
}
