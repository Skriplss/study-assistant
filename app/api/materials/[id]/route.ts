import { NextRequest, NextResponse } from 'next/server'
import { MaterialService } from '@/lib/services/MaterialService'
import { supabase } from '@/lib/supabase/client'

// GET /api/materials/:id - Get material details
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get user ID from session
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = (await params) as { id: string }
    const material = await MaterialService.getMaterial(id)

    // Check authorization
    if (material.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json({ material }, { status: 200 })
  } catch (error) {
    console.error('Get material error:', error)
    return NextResponse.json(
      { error: 'Material not found' },
      { status: 404 }
    )
        const material = await MaterialService.getMaterial(params.id)

// PUT /api/materials/:id - Update material
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get user ID from session
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check authorization
    const { id } = (await params) as { id: string }
    const existingMaterial = await MaterialService.getMaterial(id)
    if (existingMaterial.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Parse update data
    const body = await request.json()
    const { title, category, tags } = body

    // Update material
    const material = await MaterialService.updateMaterial(id, {
      title,
      category,
        const existingMaterial = await MaterialService.getMaterial(params.id)
        if (existingMaterial.userId !== user.id) {

    return NextResponse.json({ material }, { status: 200 })
  } catch (error) {
    console.error('Update material error:', error)
    const message =
      error instanceof Error ? error.message : 'Failed to update material'
    return NextResponse.json({ error: message }, { status: 500 })
  }
        const material = await MaterialService.updateMaterial(params.id, {

// DELETE /api/materials/:id - Delete material
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get user ID from session
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check authorization
    const { id } = (await params) as { id: string }
    const material = await MaterialService.getMaterial(id)
    if (material.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Delete material
    await MaterialService.deleteMaterial(id)

    return NextResponse.json(
      { message: 'Material deleted successfully' },
      { status: 200 }
    )
  } catch (error) {
    console.error('Delete material error:', error)
    const message =
      error instanceof Error ? error.message : 'Failed to delete material'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
