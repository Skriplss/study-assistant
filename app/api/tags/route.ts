import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'

// GET /api/tags - Get all unique tags for the user
export async function GET(request: NextRequest) {
  try {
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

    const query = request.nextUrl.searchParams.get('q')?.trim().toLowerCase()

    const { data: materials, error: materialsError } = await supabase
      .from('study_materials')
      .select('id')
      .eq('user_id', user.id)

    if (materialsError) {
      throw new Error(materialsError.message)
    }

    const materialIds = materials?.map((m) => m.id) ?? []
    if (materialIds.length === 0) {
      return NextResponse.json({ tags: [] }, { status: 200 })
    }

    const { data: tags, error } = await supabase
      .from('material_tags')
      .select('tag, material_id')
      .in('material_id', materialIds)

    if (error) {
      throw new Error(error.message)
    }

    const tagCounts = tags?.reduce((acc: Record<string, number>, item) => {
      acc[item.tag] = (acc[item.tag] || 0) + 1
      return acc
    }, {})

    let uniqueTags = Object.entries(tagCounts || {}).map(([tag, count]) => ({
      tag,
      count,
    }))

    if (query) {
      uniqueTags = uniqueTags.filter(({ tag }) =>
        tag.toLowerCase().includes(query)
      )
    }

    return NextResponse.json({ tags: uniqueTags }, { status: 200 })
  } catch (error) {
    console.error('Get tags error:', error)
    return NextResponse.json(
      { error: 'Failed to get tags' },
      { status: 500 }
    )
  }
}
