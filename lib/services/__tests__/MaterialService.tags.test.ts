import { MaterialService, MaterialValidationError } from '../MaterialService'

jest.mock('server-only', () => ({}))

/**
 * Records every table operation so a test can assert on the ORDER of writes —
 * the tag bug was entirely about ordering (delete committed before the insert
 * was known to be valid), which a result-only assertion cannot see.
 */
const calls: string[] = []
let tagInsertError: { message: string } | null = null

const mockDb = {
  from: jest.fn((table: string) => {
    const chain: Record<string, unknown> = {
      select: jest.fn(() => chain),
      order: jest.fn(() => chain),
      update: jest.fn(() => {
        calls.push(`${table}:update`)
        return chain
      }),
      delete: jest.fn(() => {
        calls.push(`${table}:delete`)
        return chain
      }),
      insert: jest.fn((rows: unknown) => {
        calls.push(`${table}:insert`)
        insertedRows = rows
        return Promise.resolve({
          error: table === 'material_tags' ? tagInsertError : null,
        })
      }),
      eq: jest.fn(() => chain),
      single: jest.fn().mockResolvedValue({
        data: {
          id: 'm1',
          user_id: 'u1',
          title: 'Bio',
          file_name: 'bio.pdf',
          file_type: 'pdf',
          file_size: 10,
          file_path: 'u1/m1/original.pdf',
          source_url: null,
          parsed_content: null,
          parsing_status: 'completed',
          parsing_error: null,
          category: null,
          language: null,
          created_at: '2026-08-01T00:00:00Z',
          updated_at: '2026-08-01T00:00:00Z',
        },
        error: null,
      }),
      then: (resolve: (v: { data: unknown; error: null }) => unknown) =>
        Promise.resolve({ data: [], error: null }).then(resolve),
    }
    return chain
  }),
}

let insertedRows: unknown = null

jest.mock('@/lib/supabase/server', () => ({
  getSupabaseAdmin: jest.fn(() => mockDb),
}))

beforeEach(() => {
  jest.clearAllMocks()
  calls.length = 0
  insertedRows = null
  tagInsertError = null
})

describe('MaterialService.updateMaterial — tags', () => {
  it('rejects a tag the column cannot hold, without touching what is stored', async () => {
    await expect(
      MaterialService.updateMaterial('m1', { tags: ['x'.repeat(101)] })
    ).rejects.toThrow(MaterialValidationError)

    // The point of the fix: no delete happened, so the existing tags survive.
    expect(calls).not.toContain('material_tags:delete')
  })

  it('validates before deleting, so a bad tag cannot wipe the good ones', async () => {
    await expect(
      MaterialService.updateMaterial('m1', { tags: ['fine', '!!!'] })
    ).rejects.toThrow(MaterialValidationError)

    expect(calls).not.toContain('material_tags:delete')
  })

  it('replaces tags when they are valid', async () => {
    await MaterialService.updateMaterial('m1', {
      tags: ['Biology', 'cell walls'],
    })

    expect(calls).toEqual(
      expect.arrayContaining(['material_tags:delete', 'material_tags:insert'])
    )
    // Normalized the same way the client does: lowercased, spaces to hyphens.
    expect(insertedRows).toEqual([
      { material_id: 'm1', tag: 'biology' },
      { material_id: 'm1', tag: 'cell-walls' },
    ])
  })

  it('collapses tags that normalize to the same thing', async () => {
    await MaterialService.updateMaterial('m1', {
      tags: ['React', 'react ', 'REACT'],
    })

    expect(insertedRows).toEqual([{ material_id: 'm1', tag: 'react' }])
  })

  it('surfaces a failed tag insert instead of reporting success', async () => {
    tagInsertError = { message: 'duplicate key' }

    await expect(
      MaterialService.updateMaterial('m1', { tags: ['biology'] })
    ).rejects.toThrow(/Failed to insert tags/)
  })

  it('clears tags when handed an empty list', async () => {
    await MaterialService.updateMaterial('m1', { tags: [] })

    expect(calls).toContain('material_tags:delete')
    expect(calls).not.toContain('material_tags:insert')
  })

  it('leaves tags alone when the update does not mention them', async () => {
    await MaterialService.updateMaterial('m1', { title: 'New title' })

    expect(calls).not.toContain('material_tags:delete')
  })
})
