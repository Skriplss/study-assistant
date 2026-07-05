import { prepareContent } from '../quiz-prompt'

describe('prepareContent', () => {
  it('returns content unchanged when within budget', () => {
    const small = 'short material'
    expect(prepareContent(small)).toBe(small)
  })

  it('samples windows spanning the whole document when oversized', () => {
    // Build a long doc where each region has a unique marker.
    const region = (label: string) => `${label} `.repeat(4000) // ~ big
    const content =
      region('START') + region('MIDDLE1') + region('MIDDLE2') + region('END')

    const result = prepareContent(content)

    // Must include content from both the beginning and the end, not just head.
    expect(result).toContain('START')
    expect(result).toContain('END')
    // And it must actually be smaller than the original.
    expect(result.length).toBeLessThan(content.length)
    // Windows are joined with an elision marker.
    expect(result).toContain('[...]')
  })
})
