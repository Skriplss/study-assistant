import { MaterialService, MaterialValidationError } from '../MaterialService'

jest.mock('server-only', () => ({}))

/**
 * The file that used to carry this name tested `validateMaterialFile` and never
 * touched MaterialService at all — so the module owning uploads, storage paths
 * and deletion sat at 0% coverage while looking covered. These cover the two
 * places where getting it wrong costs something real: the path built from
 * client input, and the deletion that must not lose track of a stored file.
 */

const storage = {
  info: jest.fn(),
  remove: jest.fn(),
  download: jest.fn(),
  createSignedUploadUrl: jest.fn(),
}

let materialRow: Record<string, unknown> | null = null
let insertError: { message: string } | null = null
let deleteError: { message: string } | null = null
const tableCalls: string[] = []

const mockDb = {
  storage: { from: jest.fn(() => storage) },
  from: jest.fn((table: string) => {
    tableCalls.push(table)
    const deleteChain: Record<string, unknown> = {
      eq: jest.fn(() => deleteChain),
      then: (resolve: (v: { error: unknown }) => unknown) =>
        Promise.resolve({ error: deleteError }).then(resolve),
    }
    const chain: Record<string, unknown> = {
      select: jest.fn(() => chain),
      eq: jest.fn(() => chain),
      // insert() is used both bare (tags) and as `.insert().select().single()`
      // (materials), so it stays in the chain and settles either way.
      insert: jest.fn(() => chain),
      update: jest.fn(() => chain),
      // delete() is followed by .eq(), so it has to stay in the chain and settle
      // through `then` rather than resolving on the spot.
      delete: jest.fn(() => deleteChain),
      single: jest.fn(() =>
        Promise.resolve({ data: materialRow, error: null })
      ),
      then: (resolve: (v: { data: unknown; error: null }) => unknown) =>
        Promise.resolve({ data: [], error: null }).then(resolve),
    }
    return chain
  }),
}

jest.mock('@/lib/supabase/server', () => ({
  getSupabaseAdmin: jest.fn(() => mockDb),
}))

beforeEach(() => {
  jest.clearAllMocks()
  tableCalls.length = 0
  materialRow = { file_path: 'u1/m1/original.pdf' }
  insertError = null
  deleteError = null
  storage.info.mockResolvedValue({ data: { size: 1024 }, error: null })
  storage.remove.mockResolvedValue({ error: null })
})

describe('MaterialService.finalizeUpload — the storage path', () => {
  it.each([
    ['directory traversal', '../../../etc/passwd'],
    ['a path separator', 'u2/m2'],
    ['a plain word', 'not-a-uuid'],
    ['an empty string', ''],
  ])('refuses a materialId containing %s', async (_name, materialId) => {
    await expect(
      MaterialService.finalizeUpload('u1', materialId, 'notes.pdf', { title: 'Notes' })
    ).rejects.toThrow(MaterialValidationError)

    // Nothing may reach storage: the id is interpolated into a path this method
    // can later remove() from.
    expect(storage.info).not.toHaveBeenCalled()
  })

  it('builds the path from the caller identity, never from the request', async () => {
    const materialId = '123e4567-e89b-12d3-a456-426614174000'

    await MaterialService.finalizeUpload('u1', materialId, 'notes.pdf', { title: 'Notes' })

    expect(storage.info).toHaveBeenCalledWith(`u1/${materialId}/original.pdf`)
  })

  it('refuses a file type that is not on the list', async () => {
    await expect(
      MaterialService.finalizeUpload(
        'u1',
        '123e4567-e89b-12d3-a456-426614174000',
        'payload.exe',
        { title: 'Payload' }
      )
    ).rejects.toThrow(MaterialValidationError)
  })

  it('trusts the size storage reports, not the one the client claimed', async () => {
    storage.info.mockResolvedValue({
      data: { size: 999 * 1024 * 1024 },
      error: null,
    })

    await expect(
      MaterialService.finalizeUpload(
        'u1',
        '123e4567-e89b-12d3-a456-426614174000',
        'huge.pdf',
        { title: 'Huge' }
      )
    ).rejects.toThrow(MaterialValidationError)

    // And the object it rejected does not stay in the bucket.
    expect(storage.remove).toHaveBeenCalled()
  })

  it('refuses when the object is not actually in storage', async () => {
    storage.info.mockResolvedValue({
      data: null,
      error: { message: 'not found' },
    })

    await expect(
      MaterialService.finalizeUpload(
        'u1',
        '123e4567-e89b-12d3-a456-426614174000',
        'notes.pdf',
        { title: 'Notes' }
      )
    ).rejects.toThrow(MaterialValidationError)
  })
})

describe('MaterialService.deleteMaterial', () => {
  it('removes the original and the extracted text together', async () => {
    await MaterialService.deleteMaterial('m1')

    expect(storage.remove).toHaveBeenCalledWith([
      'u1/m1/original.pdf',
      'u1/m1/extracted.txt',
    ])
  })

  it('keeps the row when the file could not be removed', async () => {
    storage.remove.mockResolvedValue({ error: { message: 'network' } })

    await expect(MaterialService.deleteMaterial('m1')).rejects.toThrow(
      /could not remove stored files/
    )

    // Dropping the row here would orphan the object: the only reference to it is
    // the row being deleted, and the privacy policy says the file goes with it.
    expect(tableCalls.filter((t) => t === 'study_materials')).toHaveLength(1)
  })

  it('skips storage entirely for a link material, which has no file', async () => {
    materialRow = { file_path: null }

    await MaterialService.deleteMaterial('m1')

    expect(storage.remove).not.toHaveBeenCalled()
  })
})
