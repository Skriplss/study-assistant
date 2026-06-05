import { MaterialParser } from '../MaterialParser'

describe('MaterialParser.parseText', () => {
  it('should parse UTF-8 text file', async () => {
    const text = 'Hello World!\nThis is a test.'
    const buffer = new TextEncoder().encode(text).buffer

    const result = await MaterialParser.parseText(buffer)

    expect(result.text).toBe(text)
    expect(result.metadata.wordCount).toBe(6)
    expect(result.metadata.structure.lines).toBe(2)
  })

  it('should handle empty text file', async () => {
    const buffer = new TextEncoder().encode('').buffer

    const result = await MaterialParser.parseText(buffer)

    expect(result.text).toBe('')
    expect(result.metadata.wordCount).toBe(0)
  })

  it('should count words correctly', async () => {
    const text = 'One two three four five'
    const buffer = new TextEncoder().encode(text).buffer

    const result = await MaterialParser.parseText(buffer)

    expect(result.metadata.wordCount).toBe(5)
  })
})

describe('MaterialParser.parseMarkdown', () => {
  it('should parse basic markdown', async () => {
    const markdown = '# Heading\n\nThis is **bold** text.'
    const buffer = new TextEncoder().encode(markdown).buffer

    const result = await MaterialParser.parseMarkdown(buffer)

    expect(result.text).toContain('Heading')
    expect(result.text).toContain('bold')
    expect(result.metadata.structure.headers).toContain('Heading')
  })

  it('should extract headers from markdown', async () => {
    const markdown = '# H1\n## H2\n### H3\nSome text'
    const buffer = new TextEncoder().encode(markdown).buffer

    const result = await MaterialParser.parseMarkdown(buffer)

    expect(result.metadata.structure.headers).toEqual(['H1', 'H2', 'H3'])
  })

  it('should convert markdown to plain text', async () => {
    const markdown = '**Bold** and *italic*'
    const buffer = new TextEncoder().encode(markdown).buffer

    const result = await MaterialParser.parseMarkdown(buffer)

    expect(result.text).not.toContain('**')
    expect(result.text).not.toContain('*')
    expect(result.text).toContain('Bold')
    expect(result.text).toContain('italic')
  })
})

describe('MaterialParser.parseWithTimeout', () => {
  it('should complete parsing within timeout', async () => {
    const parseFunction = () =>
      Promise.resolve({
        text: 'test',
        metadata: { wordCount: 1 },
      })

    const result = await MaterialParser.parseWithTimeout(parseFunction, 1000)

    expect(result.text).toBe('test')
  })

  it('should timeout for slow parsing', async () => {
    jest.useFakeTimers()

    const parseFunction = () =>
      new Promise<never>((resolve) => setTimeout(() => resolve({} as never), 35000))

    const promise = MaterialParser.parseWithTimeout(parseFunction, 1024)
    const assertion = expect(promise).rejects.toThrow('Parsing timeout exceeded')

    await jest.advanceTimersByTimeAsync(30000)
    await assertion

    jest.useRealTimers()
  })

  it('should not apply timeout for large files', async () => {
    const largeFileSize = 11 * 1024 * 1024 // 11MB
    const parseFunction = () =>
      Promise.resolve({
        text: 'large file',
        metadata: { wordCount: 2 },
      })

    const result = await MaterialParser.parseWithTimeout(
      parseFunction,
      largeFileSize
    )

    expect(result.text).toBe('large file')
  })
})

describe('MaterialParser.validateParsedContent', () => {
  it('should validate content with text', () => {
    const content = {
      text: 'Valid content',
      metadata: { wordCount: 2 },
    }

    expect(MaterialParser.validateParsedContent(content)).toBe(true)
  })

  it('should reject empty text', () => {
    const content = {
      text: '',
      metadata: { wordCount: 0 },
    }

    expect(MaterialParser.validateParsedContent(content)).toBe(false)
  })

  it('should reject whitespace-only text', () => {
    const content = {
      text: '   \n\t  ',
      metadata: { wordCount: 0 },
    }

    expect(MaterialParser.validateParsedContent(content)).toBe(false)
  })
})

describe('MaterialParser.extractSummary', () => {
  it('should extract summary from short text', () => {
    const content = {
      text: 'This is a short text.',
      metadata: { wordCount: 5 },
    }

    const summary = MaterialParser.extractSummary(content)

    expect(summary).toBe('This is a short text.')
    expect(summary).not.toContain('...')
  })

  it('should truncate long text and add ellipsis', () => {
    const longText = 'a'.repeat(600)
    const content = {
      text: longText,
      metadata: { wordCount: 1 },
    }

    const summary = MaterialParser.extractSummary(content)

    expect(summary.length).toBeLessThan(longText.length)
    expect(summary).toContain('...')
  })

  it('should extract exactly 500 characters plus ellipsis', () => {
    const longText = 'a'.repeat(1000)
    const content = {
      text: longText,
      metadata: { wordCount: 1 },
    }

    const summary = MaterialParser.extractSummary(content)

    expect(summary.length).toBe(503) // 500 + '...'
  })
})
