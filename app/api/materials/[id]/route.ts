import { NextRequest, NextResponse } from 'next/server'
import { MaterialService } from '@/lib/services/MaterialService'
import { getSupabaseAdmin } from '@/lib/supabase/server'

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: RouteParams) {
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
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await getSupabaseAdmin().auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const existingMaterial = await MaterialService.getMaterial(id)
    if (existingMaterial.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { title, category, tags } = body

    const material = await MaterialService.updateMaterial(id, { title, category, tags })

    return NextResponse.json({ material }, { status: 200 })
  } catch (error) {
    console.error('Update material error:', error)
    const message = error instanceof Error ? error.message : 'Failed to update material'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// DELETE /api/materials/:id - Delete material
export async function DELETE(request: NextRequest, { params }: RouteParams) {
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

    const { id } = await params
    const material = await MaterialService.getMaterial(id)
    if (material.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await MaterialService.deleteMaterial(id)

    return NextResponse.json({ message: 'Material deleted successfully' }, { status: 200 })
  } catch (error) {
    console.error('Delete material error:', error)
    const message = error instanceof Error ? error.message : 'Failed to delete material'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
