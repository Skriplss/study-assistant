import { ConversationService } from '../ConversationService'
import { ApiError } from '@/lib/api/errors'

jest.mock('server-only', () => ({}))

/**
 * These cover the one guard standing between users' chat histories. The client is
 * service-role, so RLS is off and `assertOwned` is the whole boundary — a dropped
 * `.eq('user_id', ...)` here would be a cross-user read with nothing else to
 * catch it. So the tests assert on the FILTERS sent to Postgres, not only on the
 * outcome: a query that returns nothing looks identical whether it was scoped
 * correctly or simply found no rows.
 */

const filters: Record<string, unknown>[] = []
let queryResult: { data: unknown } = { data: null }

const mockDb = {
  from: jest.fn(() => {
    const applied: Record<string, unknown> = {}
    const chain: Record<string, unknown> = {
      select: jest.fn(() => chain),
      order: jest.fn(() => chain),
      insert: jest.fn(() => chain),
      update: jest.fn(() => chain),
      delete: jest.fn(() => chain),
      eq: jest.fn((column: string, value: unknown) => {
        applied[column] = value
        filters.push(applied)
        return chain
      }),
      single: jest.fn(() => Promise.resolve(queryResult)),
      then: (resolve: (v: { data: unknown }) => unknown) =>
        Promise.resolve(queryResult).then(resolve),
    }
    return chain
  }),
}

jest.mock('@/lib/supabase/server', () => ({
  getSupabaseAdmin: jest.fn(() => mockDb),
}))

beforeEach(() => {
  jest.clearAllMocks()
  filters.length = 0
  queryResult = { data: null }
})

describe('ConversationService.assertOwned', () => {
  it('scopes the lookup by user as well as by id', async () => {
    queryResult = { data: { id: 'c1' } }

    await ConversationService.assertOwned('u1', 'c1')

    // Both filters, or the "ownership check" checks nothing.
    expect(filters.at(-1)).toEqual({ id: 'c1', user_id: 'u1' })
  })

  it('refuses a conversation belonging to someone else', async () => {
    queryResult = { data: null }

    await expect(ConversationService.assertOwned('u1', 'c1')).rejects.toThrow(
      ApiError
    )
  })

  it('answers 404, not 403 — a stranger learns nothing about what exists', async () => {
    queryResult = { data: null }

    await expect(
      ConversationService.assertOwned('u1', 'someone-elses-id')
    ).rejects.toMatchObject({ status: 404 })
  })
})

describe('ConversationService — writes go through the guard', () => {
  it('getMessages refuses before reading anything', async () => {
    queryResult = { data: null }

    await expect(ConversationService.getMessages('u1', 'c1')).rejects.toThrow(
      ApiError
    )
  })

  it('remove refuses before deleting anything', async () => {
    queryResult = { data: null }

    await expect(ConversationService.remove('u1', 'c1')).rejects.toThrow(
      ApiError
    )

    expect(mockDb.from).not.toHaveBeenCalledWith('messages')
  })
})
