import { NextRequest, NextResponse } from 'next/server'
import { SearchService } from '@/lib/services/SearchService'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get('session')?.value

    if (!sessionCookie) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const session = JSON.parse(sessionCookie)
    const { searchParams } = new URL(request.url)
    
    const query = searchParams.get('q') || ''
    const fileTypes = searchParams.get('types')?.split(',') as ('pdf' | 'txt' | 'md')[] | undefined
    const tags = searchParams.get('tags')?.split(',')
    const categories = searchParams.get('categories')?.split(',')

    const results = await SearchService.search(session.userId, query, {
      fileTypes,
      tags,
      categories,
    })

    return NextResponse.json(results)
  } catch (error) {
    console.error('Search error:', error)
    return NextResponse.json(
      { error: 'Search failed' },
      { status: 500 }
    )
  }
}
