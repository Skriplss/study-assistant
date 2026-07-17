import { NextRequest, NextResponse } from 'next/server'
import {
  MaterialService,
  MaterialValidationError,
} from '@/lib/services/MaterialService'
import { getSupabaseAdmin } from '@/lib/supabase/server'

/**
 * Issue a signed URL the browser uploads to directly. Only metadata crosses this
 * route, so it stays far under Vercel's 4.5MB request body cap.
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const {
      data: { user },
      error: authError,
    } = await getSupabaseAdmin().auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    const fileName = typeof body?.fileName === 'string' ? body.fileName.trim() : ''
    const fileSize = typeof body?.fileSize === 'number' ? body.fileSize : NaN

    if (!fileName || !Number.isFinite(fileSize)) {
      return NextResponse.json(
        { error: 'fileName and fileSize are required' },
        { status: 400 }
      )
    }

    const target = await MaterialService.createUploadTarget(
      user.id,
      fileName,
      fileSize
    )

    return NextResponse.json(target, { status: 200 })
  } catch (error) {
    if (error instanceof MaterialValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error('Create upload URL error:', error)
    return NextResponse.json(
      { error: 'Failed to create upload URL' },
      { status: 500 }
    )
  }
}
