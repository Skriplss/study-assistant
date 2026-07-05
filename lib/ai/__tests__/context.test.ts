import { selectRelevantContent } from '../context'

describe('selectRelevantContent', () => {
  it('returns the content unchanged when it fits the budget', () => {
    const content = 'A short study note.'
    expect(selectRelevantContent(content, 'anything', 1000)).toBe(content)
  })

  it('returns empty string for empty content', () => {
    expect(selectRelevantContent('', 'query')).toBe('')
  })

  it('keeps paragraphs matching the query and drops irrelevant ones', () => {
    const filler = 'lorem ipsum dolor sit amet consectetur '.repeat(10)
    const content = [filler, 'the zebra runs fast across plains', filler].join('\n\n')

    const result = selectRelevantContent(content, 'zebra', 80)

    expect(result).toContain('zebra')
    expect(result).not.toContain('lorem')
  })

  it('falls back to the start of the document when nothing matches', () => {
    const filler = 'lorem ipsum dolor sit amet consectetur '.repeat(10)
    const content = [filler, filler].join('\n\n')

    const result = selectRelevantContent(content, 'xylophonium', 80)

    expect(result).toBe(content.slice(0, 80))
  })
})
