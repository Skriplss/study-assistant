import { NextRequest, NextResponse } from 'next/server'
import { SearchService } from '@/lib/services/SearchService'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    // Verify Bearer token (consistent with other API routes)
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

    const { searchParams } = new URL(request.url)

    const query = searchParams.get('q') || ''
    const fileTypes = searchParams.get('types')?.split(',') as
      | ('pdf' | 'txt' | 'md')[]
      | undefined
    const tags = searchParams.get('tags')?.split(',')
    const categories = searchParams.get('categories')?.split(',')

    const results = await SearchService.search(user.id, query, {
      fileTypes,
      tags,
      categories,
    })

    return NextResponse.json(results)
  } catch (error) {
    console.error('Search error:', error)
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}
