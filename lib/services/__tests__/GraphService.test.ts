import { GraphService } from '../GraphService'

// Mock server-only
jest.mock('server-only', () => ({}))

// Mock AIService
jest.mock('../AIService', () => ({
  AIService: {
    callWithRetry: jest.fn(),
    getGroqClient: jest.fn(),
    getGeminiClient: jest.fn(),
    setFetchImplementation: jest.fn(),
    resetFetchImplementation: jest.fn(),
  },
}))

// Mock Supabase
const mockDb = {
  from: jest.fn(),
  rpc: jest.fn(),
}

jest.mock('@/lib/supabase/server', () => ({
  getSupabaseAdmin: jest.fn(() => mockDb),
}))

// Helper to build a fluent query mock that resolves to { data }
function makeQuery(data: any) {
  const chain: any = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    upsert: jest.fn().mockResolvedValue({ error: null }),
  }
  // The final awaitable resolves to { data }
  chain[Symbol.for('nodejs.rejection')] = undefined
  chain.then = (resolve: any) => Promise.resolve({ data }).then(resolve)
  return chain
}

describe('GraphService.calculateStrength (via analyzeConnections)', () => {
  // We test the private method indirectly by calling analyzeConnections
  // and verifying the strength stored in the upsert call.

  it('returns 0 when fewer than 2 materials exist', async () => {
    mockDb.from.mockReturnValue(makeQuery([{ id: 'm1', title: 'A', parsed_content: 'text', tags: [], category: null }]))

    await GraphService.analyzeConnections('user-1')

    // upsert should NOT have been called since only 1 material
    const calls = mockDb.from.mock.calls.map((c: any) => c[0])
    expect(calls).toContain('study_materials')
    // No upsert into material_connections
    const connectionCalls = mockDb.from.mock.calls.filter((c: any) => c[0] === 'material_connections')
    expect(connectionCalls).toHaveLength(0)
  })

  it('skips pairs where parsed_content is missing', async () => {
    mockDb.from.mockReturnValue(
      makeQuery([
        { id: 'm1', title: 'A', parsed_content: null, tags: [], category: null },
        { id: 'm2', title: 'B', parsed_content: 'some content', tags: [], category: null },
      ])
    )

    await GraphService.analyzeConnections('user-1')

    const connectionCalls = mockDb.from.mock.calls.filter((c: any) => c[0] === 'material_connections')
    expect(connectionCalls).toHaveLength(0)
  })
})

describe('GraphService strength calculation', () => {
  // Access private method via type cast
  const svc = GraphService as any

  it('increases with more shared concepts', () => {
    const s1 = svc.calculateStrength(['a'], [], [])
    const s5 = svc.calculateStrength(['a', 'b', 'c', 'd', 'e'], [], [])
    expect(s5).toBeGreaterThan(s1)
  })

  it('adds tag bonus when tags overlap', () => {
    const noTags = svc.calculateStrength(['a', 'b'], [], [])
    const withTags = svc.calculateStrength(['a', 'b'], ['react'], ['react'])
    expect(withTags).toBeGreaterThan(noTags)
  })

  it('never exceeds 1.0', () => {
    const many = Array.from({ length: 20 }, (_, i) => `concept${i}`)
    const score = svc.calculateStrength(many, ['t1', 't2', 't3', 't4', 't5'], ['t1', 't2', 't3', 't4', 't5'])
    expect(score).toBeLessThanOrEqual(1.0)
  })

  it('returns 0 for empty concepts and no shared tags', () => {
    const score = svc.calculateStrength([], [], [])
    expect(score).toBe(0)
  })
})

describe('GraphService.getGraph', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('maps materials to nodes correctly', async () => {
    mockDb.from.mockImplementation((table: string) => {
      if (table === 'study_materials') {
        return makeQuery([
          { id: 'm1', title: 'Material A', category: 'CS', tags: ['js'] },
          { id: 'm2', title: 'Material B', category: null, tags: [] },
        ])
      }
      if (table === 'material_connections') {
        return makeQuery([])
      }
      return makeQuery([])
    })

    const graph = await GraphService.getGraph('user-1')

    expect(graph.nodes).toHaveLength(2)
    expect(graph.nodes[0]).toMatchObject({
      id: 'm1',
      label: 'Material A',
      type: 'material',
      data: { category: 'CS', tags: ['js'] },
    })
    expect(graph.edges).toHaveLength(0)
  })

  it('maps connections to edges with correct ids', async () => {
    mockDb.from.mockImplementation((table: string) => {
      if (table === 'study_materials') return makeQuery([])
      if (table === 'material_connections') {
        return makeQuery([
          {
            material_id_1: 'ma',
            material_id_2: 'mb',
            connection_strength: 0.8,
            shared_concepts: ['topic1', 'topic2'],
          },
        ])
      }
      return makeQuery([])
    })

    const graph = await GraphService.getGraph('user-1')

    expect(graph.edges).toHaveLength(1)
    expect(graph.edges[0]).toMatchObject({
      id: 'ma-mb',
      source: 'ma',
      target: 'mb',
      strength: 0.8,
      sharedConcepts: ['topic1', 'topic2'],
    })
  })

  it('handles missing shared_concepts gracefully', async () => {
    mockDb.from.mockImplementation((table: string) => {
      if (table === 'study_materials') return makeQuery([])
      if (table === 'material_connections') {
        return makeQuery([
          { material_id_1: 'a', material_id_2: 'b', connection_strength: 0.5, shared_concepts: null },
        ])
      }
      return makeQuery([])
    })

    const graph = await GraphService.getGraph('user-1')
    expect(graph.edges[0].sharedConcepts).toEqual([])
  })

  it('returns empty graph when no data', async () => {
    mockDb.from.mockReturnValue(makeQuery([]))

    const graph = await GraphService.getGraph('user-1')
    expect(graph.nodes).toHaveLength(0)
    expect(graph.edges).toHaveLength(0)
  })
})
