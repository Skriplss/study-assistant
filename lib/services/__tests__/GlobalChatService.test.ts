import { GlobalChatService } from '../GlobalChatService'
import { SearchService } from '../SearchService'

jest.mock('server-only', () => ({}))

jest.mock('../SearchService', () => ({
  SearchService: { search: jest.fn() },
}))

const mockDb = { from: jest.fn() }

jest.mock('@/lib/supabase/server', () => ({
  getSupabaseAdmin: jest.fn(() => mockDb),
}))

// Fluent Supabase query mock that resolves to { data }. Every builder method
// returns the chain; awaiting it (or .single()/.limit()) yields { data }.
function makeQuery(data: any) {
  const chain: any = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    not: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    single: jest.fn().mockReturnThis(),
    then: (resolve: any) => Promise.resolve({ data }).then(resolve),
  }
  return chain
}

const searchMock = SearchService.search as jest.Mock

function searchResult(id: string, title: string, content: string | null) {
  return { material: { id, title, parsedContent: content }, relevanceScore: 1, matchedTerms: [], snippet: '' }
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('GlobalChatService.buildContext — scoped to a single material', () => {
  it('builds a single-source context for the given material', async () => {
    mockDb.from.mockReturnValue(
      makeQuery({ id: 'm1', title: 'Photosynthesis', parsed_content: 'light reactions happen here' })
    )

    const { context, sources } = await GlobalChatService.buildContext('user-1', 'how does it work', 'm1')

    expect(sources).toEqual([{ id: 'm1', title: 'Photosynthesis' }])
    expect(context).toContain('[Source 1: Photosynthesis]')
    expect(context).toContain('light reactions happen here')
    // Scoped path must not run the keyword search over the whole library.
    expect(searchMock).not.toHaveBeenCalled()
  })

  it('returns empty when the scoped material is missing or not owned', async () => {
    mockDb.from.mockReturnValue(makeQuery(null))

    const result = await GlobalChatService.buildContext('user-1', 'q', 'missing-id')

    expect(result).toEqual({ context: '', sources: [] })
  })

  it('returns empty when the scoped material has no parsed content', async () => {
    mockDb.from.mockReturnValue(makeQuery({ id: 'm1', title: 'Doc', parsed_content: null }))

    const result = await GlobalChatService.buildContext('user-1', 'q', 'm1')

    expect(result).toEqual({ context: '', sources: [] })
  })
})

describe('GlobalChatService.buildContext — across all materials', () => {
  it('ranks via search and labels each source in order', async () => {
    searchMock.mockResolvedValue([
      searchResult('a', 'Alpha', 'alpha content'),
      searchResult('b', 'Beta', 'beta content'),
    ])

    const { context, sources } = await GlobalChatService.buildContext('user-1', 'overview')

    expect(sources).toEqual([
      { id: 'a', title: 'Alpha' },
      { id: 'b', title: 'Beta' },
    ])
    expect(context).toContain('[Source 1: Alpha]')
    expect(context).toContain('[Source 2: Beta]')
  })

  it('skips search hits that have no parsed content', async () => {
    searchMock.mockResolvedValue([
      searchResult('a', 'Alpha', null),
      searchResult('b', 'Beta', 'beta content'),
    ])

    const { sources } = await GlobalChatService.buildContext('user-1', 'q')

    expect(sources).toEqual([{ id: 'b', title: 'Beta' }])
  })

  it('caps the number of sources at 4', async () => {
    searchMock.mockResolvedValue(
      Array.from({ length: 6 }, (_, i) => searchResult(`m${i}`, `Title ${i}`, `content ${i}`))
    )

    const { sources } = await GlobalChatService.buildContext('user-1', 'q')

    expect(sources).toHaveLength(4)
  })

  it('falls back to recent materials when search finds nothing', async () => {
    searchMock.mockResolvedValue([])
    mockDb.from.mockReturnValue(
      makeQuery([
        { id: 'r1', title: 'Recent One', parsed_content: 'recent content one' },
        { id: 'r2', title: 'Recent Two', parsed_content: 'recent content two' },
      ])
    )

    const { context, sources } = await GlobalChatService.buildContext('user-1', 'summarize everything')

    expect(sources).toEqual([
      { id: 'r1', title: 'Recent One' },
      { id: 'r2', title: 'Recent Two' },
    ])
    expect(context).toContain('[Source 1: Recent One]')
  })

  it('returns empty when the user has no materials at all', async () => {
    searchMock.mockResolvedValue([])
    mockDb.from.mockReturnValue(makeQuery([]))

    const result = await GlobalChatService.buildContext('user-1', 'q')

    expect(result).toEqual({ context: '', sources: [] })
  })
})
