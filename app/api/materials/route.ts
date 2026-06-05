import { NextRequest, NextResponse } from 'next/server'
import { MaterialService } from '@/lib/services/MaterialService'
import { supabase } from '@/lib/supabase/client'

// GET /api/materials - List all materials for the user
export async function GET(request: NextRequest) {
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

    // Get materials
    const materials = await MaterialService.listMaterials(user.id)

    return NextResponse.json({ materials }, { status: 200 })
  } catch (error) {
    console.error('List materials error:', error)
    return NextResponse.json(
      { error: 'Failed to list materials' },
      { status: 500 }
    )
  }
}

// POST /api/materials - Upload a new material
export async function POST(request: NextRequest) {
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

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File
    const title = formData.get('title') as string
    const category = formData.get('category') as string | null
    const tagsStr = formData.get('tags') as string | null

    if (!file) {
      return NextResponse.json(
        { error: 'File is required' },
        { status: 400 }
      )
    }

    const tags = tagsStr ? tagsStr.split(',').map((t) => t.trim()) : undefined

    // Upload material
    const material = await MaterialService.uploadMaterial(user.id, file, {
      title: title || file.name.replace(/\.[^/.]+$/, ''),
      category: category || undefined,
      tags,
    })

    return NextResponse.json({ material }, { status: 201 })
  } catch (error) {
    console.error('Upload material error:', error)
    const message =
      error instanceof Error ? error.message : 'Failed to upload material'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
