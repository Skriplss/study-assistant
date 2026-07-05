import { NextRequest, NextResponse } from 'next/server'
import { MaterialService } from '@/lib/services/MaterialService'
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

export async function POST(request: NextRequest) {
  let formData: FormData | null = null
  let file: File | null = null
  
  console.log('[Upload] Request received:', {
    contentType: request.headers.get('content-type'),
    contentLength: request.headers.get('content-length'),
  })
  
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      console.log('[Upload] Missing authorization header')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await getSupabaseAdmin().auth.getUser(token)

    if (authError || !user) {
      console.log('[Upload] Auth error:', authError)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('[Upload] User authenticated:', user.id)

    // Link-based materials (YouTube / web URL) arrive as JSON, not multipart.
    const contentType = request.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      const body = await request.json()
      const sourceUrl = typeof body.sourceUrl === 'string' ? body.sourceUrl.trim() : ''

      if (!sourceUrl) {
        return NextResponse.json({ error: 'sourceUrl is required' }, { status: 400 })
      }
      try {
        new URL(sourceUrl)
      } catch {
        return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
      }

      const fileType = isYouTubeUrl(sourceUrl) ? 'youtube' : 'url'
      const rawTags = body.tags
      const tags = Array.isArray(rawTags)
        ? rawTags.map((t: unknown) => String(t).trim()).filter(Boolean)
        : typeof rawTags === 'string'
          ? rawTags.split(',').map((t) => t.trim()).filter(Boolean)
          : undefined

      const material = await MaterialService.createLinkMaterial(user.id, sourceUrl, fileType, {
        title: typeof body.title === 'string' && body.title.trim() ? body.title.trim() : sourceUrl,
        category: typeof body.category === 'string' && body.category ? body.category : undefined,
        tags,
      })

      return NextResponse.json({ material }, { status: 201 })
    }

    try {
      console.log('[Upload] Parsing form data...')
      formData = await request.formData()
      console.log('[Upload] Form data parsed successfully')
    } catch (parseError) {
      console.error('[Upload] Failed to parse form data:', parseError)
      return NextResponse.json({ 
        error: 'Invalid request format. Please ensure you are uploading a file.',
        details: parseError instanceof Error ? parseError.message : String(parseError)
      }, { status: 400 })
    }

    file = formData.get('file') as File
    const title = formData.get('title') as string
    const category = formData.get('category') as string | null
    const tagsStr = formData.get('tags') as string | null

    console.log('[Upload] File info:', {
      name: file?.name,
      size: file?.size,
      type: file?.type,
      title,
      category,
      tags: tagsStr,
    })

    if (!file) {
      console.log('[Upload] File is missing from form data')
      return NextResponse.json({ error: 'File is required' }, { status: 400 })
    }

    // Validate file size (max 75MB)
    const maxSize = 75 * 1024 * 1024
    if (file.size > maxSize) {
      console.log('[Upload] File too large:', file.size)
      return NextResponse.json({ error: 'File size exceeds 75MB limit' }, { status: 400 })
    }

    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'text/plain',
      'text/markdown',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.ms-powerpoint',
      'image/png',
      'image/jpeg',
      'image/jpg'
    ]
    const allowedExtensions = /\.(pdf|txt|md|pptx|ppt|png|jpg|jpeg)$/i
    
    if (!allowedTypes.includes(file.type) && !file.name.match(allowedExtensions)) {
      console.log('[Upload] Invalid file type:', file.type)
      return NextResponse.json({ 
        error: 'Invalid file type. Only PDF, TXT, MD, PPTX, PNG, JPG, and JPEG files are allowed' 
      }, { status: 400 })
    }

    const tags = tagsStr ? tagsStr.split(',').map((t) => t.trim()).filter(Boolean) : undefined

    console.log('[Upload] Starting MaterialService.uploadMaterial...')
    const material = await MaterialService.uploadMaterial(user.id, file, {
      title: title || file.name.replace(/\.[^/.]+$/, ''),
      category: category || undefined,
      tags,
    })
    console.log('[Upload] Material uploaded successfully:', material.id)

    return NextResponse.json({ material }, { status: 201 })
  } catch (error) {
    console.error('[Upload] Upload material error:', error)
    console.error('[Upload] Error details:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : 'No stack trace',
      fileName: file?.name,
      fileSize: file?.size,
    })
    
    const message = error instanceof Error ? error.message : 'Failed to upload material'
    
    // Always return JSON, never let it fall through to default error handler
    return NextResponse.json({ 
      error: message,
      details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : String(error)) : undefined
    }, { 
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      }
    })
  }
}