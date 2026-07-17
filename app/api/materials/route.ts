import { NextRequest, NextResponse } from 'next/server'
import {
  MaterialService,
  MaterialValidationError,
} from '@/lib/services/MaterialService'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { isYouTubeUrl } from '@/lib/materials/youtube'

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await getSupabaseAdmin().auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const materials = await MaterialService.listMaterials(user.id)
    return NextResponse.json({ materials }, { status: 200 })
  } catch (error) {
    console.error('List materials error:', error)
    return NextResponse.json({ error: 'Failed to list materials' }, { status: 500 })
  }
}

export const maxDuration = 60 // Max duration in seconds for Vercel

/**
 * Create a material. Uploaded files are already in storage by the time this runs
 * (see /api/materials/upload-url), so only metadata arrives here — this route never
 * carries a body large enough for Vercel's 4.5MB edge cap to reject.
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await getSupabaseAdmin().auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    if (!body) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const rawTags = body.tags
    const tags = Array.isArray(rawTags)
      ? rawTags.map((t: unknown) => String(t).trim()).filter(Boolean)
      : typeof rawTags === 'string'
        ? rawTags.split(',').map((t: string) => t.trim()).filter(Boolean)
        : undefined

    const category =
      typeof body.category === 'string' && body.category ? body.category : undefined

    // A file the browser has already uploaded straight to storage.
    if (typeof body.materialId === 'string' && body.materialId) {
      const fileName = typeof body.fileName === 'string' ? body.fileName.trim() : ''
      if (!fileName) {
        return NextResponse.json({ error: 'fileName is required' }, { status: 400 })
      }

      const material = await MaterialService.finalizeUpload(
        user.id,
        body.materialId,
        fileName,
        {
          title:
            typeof body.title === 'string' && body.title.trim()
              ? body.title.trim()
              : fileName.replace(/\.[^/.]+$/, ''),
          category,
          tags,
        }
      )

      return NextResponse.json({ material }, { status: 201 })
    }

    // Link-based materials (YouTube / web URL) carry no file at all.
    const sourceUrl = typeof body.sourceUrl === 'string' ? body.sourceUrl.trim() : ''
    if (!sourceUrl) {
      return NextResponse.json(
        { error: 'materialId or sourceUrl is required' },
        { status: 400 }
      )
    }
    try {
      new URL(sourceUrl)
    } catch {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
    }

    const fileType = isYouTubeUrl(sourceUrl) ? 'youtube' : 'url'
    const material = await MaterialService.createLinkMaterial(user.id, sourceUrl, fileType, {
      title: typeof body.title === 'string' && body.title.trim() ? body.title.trim() : sourceUrl,
      category,
      tags,
    })

    return NextResponse.json({ material }, { status: 201 })
  } catch (error) {
    if (error instanceof MaterialValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error('Create material error:', error)
    return NextResponse.json({ error: 'Failed to create material' }, { status: 500 })
  }
}