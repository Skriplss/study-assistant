import { NextRequest, NextResponse } from 'next/server'
import { MaterialService } from '@/lib/services/MaterialService'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { errorResponse } from '@/lib/api/response'

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.substring(7)
    const {
      data: { user },
      error: authError,
    } = await getSupabaseAdmin().auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const material = await MaterialService.getMaterial(id)

    if (material.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json({ material }, { status: 200 })
  } catch (error) {
    console.error('Get material error:', error)
    return NextResponse.json({ error: 'Material not found' }, { status: 404 })
  }
}

// PUT /api/materials/:id - Update material
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.substring(7)
    const {
      data: { user },
      error: authError,
    } = await getSupabaseAdmin().auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const ownerId = await MaterialService.getMaterialOwner(id)
    if (ownerId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { title, category } = body

    // Same coercion as POST /api/materials — a non-array here used to reach
    // updateMaterial, which deletes the old tags before choking on the value.
    const rawTags = body.tags
    const tags = Array.isArray(rawTags)
      ? rawTags.map((t: unknown) => String(t).trim()).filter(Boolean)
      : typeof rawTags === 'string'
        ? rawTags
            .split(',')
            .map((t: string) => t.trim())
            .filter(Boolean)
        : undefined

    const material = await MaterialService.updateMaterial(id, {
      title,
      category,
      tags,
    })

    return NextResponse.json({ material }, { status: 200 })
  } catch (error) {
    console.error('Update material error:', error)
    return errorResponse(error, 'Failed to update material')
  }
}

// DELETE /api/materials/:id - Delete material
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.substring(7)
    const {
      data: { user },
      error: authError,
    } = await getSupabaseAdmin().auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const ownerId = await MaterialService.getMaterialOwner(id)
    if (ownerId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await MaterialService.deleteMaterial(id)

    return NextResponse.json(
      { message: 'Material deleted successfully' },
      { status: 200 }
    )
  } catch (error) {
    console.error('Delete material error:', error)
    return errorResponse(error, 'Failed to delete material')
  }
}
