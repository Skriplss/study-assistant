import { MaterialParser } from '../MaterialParser'

const enc = (s: string) => new TextEncoder().encode(s).buffer

describe('MaterialParser text cleaning', () => {
  it('preserves paragraph breaks instead of collapsing to one line', async () => {
    const raw =
      'First paragraph line one.\nStill first paragraph.\n\n' +
      'Second paragraph here with enough words to be meaningful content.\n\n\n' +
      'Third paragraph after several blank lines carries extra detail too.'

    const parsed = await MaterialParser.parseText(enc(raw))

    // Paragraph separators survive.
    expect(parsed.text).toContain('\n\n')
    // 3+ blank lines are collapsed to a single blank line (one \n\n, not \n\n\n).
    expect(parsed.text).not.toContain('\n\n\n')
    // Structure reflects real paragraphs, not a single blob.
    expect(parsed.metadata.structure.paragraphCount).toBeGreaterThanOrEqual(3)
  })

  it('collapses runs of spaces/tabs and drops standalone page numbers', async () => {
    const raw =
      'Alpha    beta\tgamma delta epsilon zeta with plenty of words here.\n' +
      '42\n' +
      'Another meaningful sentence follows the stray page number above.'

    const parsed = await MaterialParser.parseText(enc(raw))

    expect(parsed.text).toContain('Alpha beta gamma')
    // The standalone "42" page-number line is removed.
    expect(parsed.text).not.toMatch(/(^|\n)42(\n|$)/)
  })
})
