import pdfParse from 'pdf-parse'
import MarkdownIt from 'markdown-it'
import officeParser from 'officeparser'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { detectMaterialLanguage } from '@/lib/ai/language-detection'
import type { ParsedContent } from '@/lib/types'

export class MaterialParser {
  private static readonly PARSING_TIMEOUT = 60000 // 60 seconds for large files
  private static readonly MAX_FILE_SIZE_FOR_TIMEOUT = 20 * 1024 * 1024 // 20MB
  private static markdown = new MarkdownIt()
  private static gemini: GoogleGenerativeAI | null = null

  private static getGeminiClient(): GoogleGenerativeAI {
    if (!this.gemini) {
      const apiKey = process.env.GOOGLE_AI_API_KEY
      if (!apiKey) throw new Error('GOOGLE_AI_API_KEY not configured')
      this.gemini = new GoogleGenerativeAI(apiKey)
    }
    return this.gemini
  }

  /**
   * Clean extracted text from common PDF artifacts
   */
  private static cleanText(text: string): string {
    return text
      // Remove excessive whitespace
      .replace(/\s+/g, ' ')
      // Remove page numbers (standalone numbers)
      .replace(/^\s*\d+\s*$/gm, '')
      // Remove common PDF artifacts
      .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '')
      // Fix hyphenation at line breaks
      .replace(/(\w+)-\s+(\w+)/g, '$1$2')
      // Normalize line breaks
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      // Remove multiple consecutive newlines
      .replace(/\n{3,}/g, '\n\n')
      // Trim each line
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .join('\n')
      .trim()
  }

  /**
   * Parse PDF file and extract ALL text content with better handling
   */
  static async parsePDF(buffer: ArrayBuffer): Promise<ParsedContent> {
    try {
      const data = await pdfParse(Buffer.from(buffer), {
        // Extract all pages
        max: 0, // 0 means no limit
        version: 'v2.0.550', // Use latest version
      })

      // Clean the extracted text
      const cleanedText = this.cleanText(data.text)

      // Validate that we got meaningful content
      if (!cleanedText || cleanedText.length < 50) {
        throw new Error('PDF parsing extracted insufficient text. The PDF may be image-based or corrupted.')
      }

      // Extract structure info
      const lines = cleanedText.split('\n')
      const paragraphs = cleanedText.split('\n\n').filter(p => p.length > 0)

      return {
        text: cleanedText,
        metadata: {
          pageCount: data.numpages,
          wordCount: cleanedText.split(/\s+/).filter(Boolean).length,
          structure: {
            info: data.info,
            metadata: data.metadata,
            lineCount: lines.length,
            paragraphCount: paragraphs.length,
            averageWordsPerParagraph: Math.round(
              cleanedText.split(/\s+/).length / paragraphs.length
            ),
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
      let encoding = 'utf-8'
      
      try {
        const decoder = new TextDecoder('utf-8', { fatal: true })
        text = decoder.decode(buffer)
      } catch {
        // Fall back to Latin-1 if UTF-8 fails
        const decoder = new TextDecoder('iso-8859-1')
        text = decoder.decode(buffer)
        encoding = 'iso-8859-1'
      }

      // Clean the text
      const cleanedText = this.cleanText(text)

      const lines = cleanedText.split('\n')
      const paragraphs = cleanedText.split('\n\n').filter(p => p.length > 0)

      return {
        text: cleanedText,
        metadata: {
          wordCount: cleanedText.split(/\s+/).filter(Boolean).length,
          structure: {
            lineCount: lines.length,
            paragraphCount: paragraphs.length,
            encoding,
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

      // Clean the text
      const cleanedText = this.cleanText(plainText)

      // Extract headers for structure
      const headers: Array<{ level: number; text: string }> = []
      const headerRegex = /^(#{1,6})\s+(.+)$/gm
      let match
      while ((match = headerRegex.exec(markdownText)) !== null) {
        headers.push({
          level: match[1].length,
          text: match[2],
        })
      }

      // Extract code blocks
      const codeBlocks: string[] = []
      const codeRegex = /```[\s\S]*?```/g
      let codeMatch
      while ((codeMatch = codeRegex.exec(markdownText)) !== null) {
        codeBlocks.push(codeMatch[0])
      }

      const lines = markdownText.split('\n')
      const paragraphs = cleanedText.split('\n\n').filter(p => p.length > 0)

      return {
        text: cleanedText,
        metadata: {
          wordCount: cleanedText.split(/\s+/).filter(Boolean).length,
          structure: {
            lineCount: lines.length,
            paragraphCount: paragraphs.length,
            headers,
            codeBlockCount: codeBlocks.length,
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
   * Parse PPTX file using officeparser
   */
  static async parsePPTX(buffer: ArrayBuffer): Promise<ParsedContent> {
    try {
      console.log('[MaterialParser] Attempting to parse PPTX with officeparser...')
      const text = await officeParser.parseOffice(Buffer.from(buffer), {
        fileType: 'pptx'
      })
      
      console.log('[MaterialParser] PPTX raw text length:', text?.length || 0)
      
      if (!text || typeof text !== 'string' || text.trim().length === 0) {
        console.log('[MaterialParser] officeparser returned empty text, this PPTX may contain only images')
        // Return empty but valid result - user can still use the file
        return {
          text: 'This presentation appears to contain primarily visual content. Text extraction was not possible with the current parser.',
          metadata: {
            wordCount: 0,
            lineCount: 1,
            paragraphCount: 1,
          }
        }
      }

      const cleanedText = this.cleanText(text)

      if (!cleanedText || cleanedText.length < 10) {
        console.log('[MaterialParser] Cleaned text too short:', cleanedText?.length)
        return {
          text: 'This presentation contains minimal text content.',
          metadata: {
            wordCount: 0,
            lineCount: 1,
            paragraphCount: 1,
          }
        }
      }

      const lines = cleanedText.split('\n')
      const paragraphs = cleanedText.split('\n\n').filter(p => p.length > 0)

      return {
        text: cleanedText,
        metadata: {
          wordCount: cleanedText.split(/\s+/).filter(Boolean).length,
          structure: {
            lineCount: lines.length,
            paragraphCount: paragraphs.length,
            fileType: 'pptx',
          },
        },
      }
    } catch (error) {
      throw new Error(
        `PPTX parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Parse image file using Google Gemini Vision API
   */
  static async parseImage(buffer: ArrayBuffer, fileType: 'png' | 'jpg' | 'jpeg'): Promise<ParsedContent> {
    try {
      const gemini = this.getGeminiClient()
      const model = gemini.getGenerativeModel({ model: 'gemini-2.0-flash' })

      // Convert buffer to base64
      const base64Image = Buffer.from(buffer).toString('base64')
      const mimeType = fileType === 'png' ? 'image/png' : 'image/jpeg'

      // Send image to Gemini Vision API
      const prompt = 'Extract all text from this image. If it contains diagrams, formulas, or charts, describe them in detail.'
      
      const result = await model.generateContent([
        {
          inlineData: {
            data: base64Image,
            mimeType,
          },
        },
        prompt,
      ])

      const response = result.response
      const extractedText = response.text()

      if (!extractedText || extractedText.trim().length === 0) {
        throw new Error('No text or content could be extracted from the image')
      }

      const cleanedText = this.cleanText(extractedText)

      return {
        text: cleanedText,
        metadata: {
          wordCount: cleanedText.split(/\s+/).filter(Boolean).length,
          structure: {
            fileType: 'image',
            imageFormat: fileType,
            extractionMethod: 'gemini-vision',
          },
        },
      }
    } catch (error) {
      throw new Error(
        `Image parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
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
    // Only apply timeout for files under threshold
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
    fileType: 'pdf' | 'txt' | 'md' | 'pptx' | 'png' | 'jpg' | 'jpeg',
    fileSize: number
  ): Promise<ParsedContent> {
    try {
      let parsedContent: ParsedContent

      switch (fileType) {
        case 'pdf':
          parsedContent = await this.parseWithTimeout(
            () => this.parsePDF(buffer),
            fileSize
          )
          break
        case 'txt':
          parsedContent = await this.parseWithTimeout(
            () => this.parseText(buffer),
            fileSize
          )
          break
        case 'md':
          parsedContent = await this.parseWithTimeout(
            () => this.parseMarkdown(buffer),
            fileSize
          )
          break
        case 'pptx':
          parsedContent = await this.parseWithTimeout(
            () => this.parsePPTX(buffer),
            fileSize
          )
          break
        case 'png':
        case 'jpg':
        case 'jpeg':
          parsedContent = await this.parseWithTimeout(
            () => this.parseImage(buffer, fileType),
            fileSize
          )
          break
        default:
          throw new Error(`Unsupported file type: ${fileType}`)
      }

      // Detect language from parsed text
      const detectedLanguage = detectMaterialLanguage(parsedContent.text)
      parsedContent.language = detectedLanguage

      return parsedContent
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
    if (content.text.trim().length < 50) {
      return false // Too short to be meaningful
    }
    if (content.metadata.wordCount < 10) {
      return false // Too few words
    }
    return true
  }

  /**
   * Extract summary from parsed content (first 1000 characters)
   */
  static extractSummary(content: ParsedContent): string {
    const summary = content.text.substring(0, 1000).trim()
    return summary.length < content.text.length ? `${summary}...` : summary
  }
}
