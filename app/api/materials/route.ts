import { NextRequest, NextResponse } from 'next/server'
import { MaterialService } from '@/lib/services/MaterialService'
import { getSupabaseAdmin } from '@/lib/supabase/server'

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

    const formData = await request.formData()
    const file = formData.get('file') as File
    const title = formData.get('title') as string
    const category = formData.get('category') as string | null
    const tagsStr = formData.get('tags') as string | null

    if (!file) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 })
    }

    const tags = tagsStr ? tagsStr.split(',').map((t) => t.trim()) : undefined

    const material = await MaterialService.uploadMaterial(user.id, file, {
      title: title || file.name.replace(/\.[^/.]+$/, ''),
      category: category || undefined,
      tags,
    })

    return NextResponse.json({ material }, { status: 201 })
  } catch (error) {
    console.error('Upload material error:', error)
    const message = error instanceof Error ? error.message : 'Failed to upload material'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}