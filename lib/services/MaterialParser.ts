import pdfParse from 'pdf-parse'
import MarkdownIt from 'markdown-it'
import type { ParsedContent } from '@/lib/types'

export class MaterialParser {
  private static readonly PARSING_TIMEOUT = 30000 // 30 seconds
  private static readonly MAX_FILE_SIZE_FOR_TIMEOUT = 10 * 1024 * 1024 // 10MB
  private static markdown = new MarkdownIt()

  /**
   * Parse PDF file and extract text content
   */
  static async parsePDF(buffer: ArrayBuffer): Promise<ParsedContent> {
    try {
      const data = await pdfParse(Buffer.from(buffer))

      return {
        text: data.text,
        metadata: {
          pageCount: data.numpages,
          wordCount: data.text.split(/\s+/).filter(Boolean).length,
          structure: {
            info: data.info,
            metadata: data.metadata,
          },
        },
      }
    } catch (error) {
      throw new Error(
        `PDF parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Parse text file with encoding detection
   */
  static async parseText(buffer: ArrayBuffer): Promise<ParsedContent> {
    try {
      // Try UTF-8 first
      let text: string
      try {
        const decoder = new TextDecoder('utf-8', { fatal: true })
        text = decoder.decode(buffer)
      } catch {
        // Fall back to Latin-1 if UTF-8 fails
        const decoder = new TextDecoder('iso-8859-1')
        text = decoder.decode(buffer)
      }

      return {
        text,
        metadata: {
          wordCount: text.split(/\s+/).filter(Boolean).length,
          structure: {
            lines: text.split('\n').length,
            encoding: 'utf-8',
          },
        },
      }
    } catch (error) {
      throw new Error(
        `Text parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Parse Markdown file
   */
  static async parseMarkdown(buffer: ArrayBuffer): Promise<ParsedContent> {
    try {
      // Decode text
      const decoder = new TextDecoder('utf-8')
      const markdownText = decoder.decode(buffer)

      // Parse markdown to extract plain text
      const html = this.markdown.render(markdownText)
      const plainText = html
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, ' ')
        .trim()

      // Extract headers for structure
      const headers: string[] = []
      const headerRegex = /^#{1,6}\s+(.+)$/gm
      let match
      while ((match = headerRegex.exec(markdownText)) !== null) {
        headers.push(match[1])
      }

      return {
        text: plainText,
        metadata: {
          wordCount: plainText.split(/\s+/).filter(Boolean).length,
          structure: {
            lines: markdownText.split('\n').length,
            headers,
            rawMarkdown: markdownText,
          },
        },
      }
    } catch (error) {
      throw new Error(
        `Markdown parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Parse file with timeout
   */
  static async parseWithTimeout(
    parseFunction: () => Promise<ParsedContent>,
    fileSize: number
  ): Promise<ParsedContent> {
    // Only apply timeout for files under 10MB
    if (fileSize >= this.MAX_FILE_SIZE_FOR_TIMEOUT) {
      return parseFunction()
    }

    return Promise.race([
      parseFunction(),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error('Parsing timeout exceeded')),
          this.PARSING_TIMEOUT
        )
      ),
    ])
  }

  /**
   * Main parsing method that routes to appropriate parser
   */
  static async parseMaterial(
    buffer: ArrayBuffer,
    fileType: 'pdf' | 'txt' | 'md',
    fileSize: number
  ): Promise<ParsedContent> {
    try {
      switch (fileType) {
        case 'pdf':
          return await this.parseWithTimeout(
            () => this.parsePDF(buffer),
            fileSize
          )
        case 'txt':
          return await this.parseWithTimeout(
            () => this.parseText(buffer),
            fileSize
          )
        case 'md':
          return await this.parseWithTimeout(
            () => this.parseMarkdown(buffer),
            fileSize
          )
        default:
          throw new Error(`Unsupported file type: ${fileType}`)
      }
    } catch (error) {
      if (error instanceof Error) {
        throw error
      }
      throw new Error('Parsing failed with unknown error')
    }
  }

  /**
   * Validate parsed content
   */
  static validateParsedContent(content: ParsedContent): boolean {
    if (!content.text || content.text.trim().length === 0) {
      return false
    }
    if (content.metadata.wordCount === 0) {
      return false
    }
    return true
  }

  /**
   * Extract summary from parsed content (first 500 characters)
   */
  static extractSummary(content: ParsedContent): string {
    const summary = content.text.substring(0, 500).trim()
    return summary.length < content.text.length ? `${summary}...` : summary
  }
}
