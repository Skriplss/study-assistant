import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'

// GET /api/categories - Get all unique categories for the user
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

    // Get all categories with counts
    const { data: materials, error } = await supabase
      .from('study_materials')
      .select('category')
      .eq('user_id', user.id)
      .not('category', 'is', null)

    if (error) {
      throw new Error(error.message)
    }

    // Count categories
    const categoryCounts = materials?.reduce((acc: Record<string, number>, item) => {
      if (item.category) {
        acc[item.category] = (acc[item.category] || 0) + 1
      }
      return acc
    }, {})

    const categories = Object.entries(categoryCounts || {}).map(([category, count]) => ({
      category,
      count,
    }))

    return NextResponse.json({ categories }, { status: 200 })
  } catch (error) {
    console.error('Get categories error:', error)
    return NextResponse.json(
      { error: 'Failed to get categories' },
      { status: 500 }
    )
  }
}
