/**
 * @jest-environment node
 *
 * pdf.js is loaded for real here — mocking it would test the mock, and the point
 * of this file is that swapping the parser did not change what comes out.
 */
import { extractPdfText } from '../pdf-text'

/**
 * Build a small but genuinely valid PDF: correct object offsets and xref table,
 * one page, one text-showing operator per line. Generating it beats committing a
 * binary fixture nobody can read in a diff.
 */
function makePdf(lines: string[]): ArrayBuffer {
  const escape = (s: string) => s.replace(/([\\()])/g, '\\$1')
  const content =
    'BT /F1 12 Tf 20 700 Td 14 TL\n' +
    lines.map((line) => `(${escape(line)}) Tj T*`).join('\n') +
    '\nET'

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] ' +
      '/Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]

  let pdf = '%PDF-1.4\n'
  const offsets: number[] = []
  objects.forEach((body, index) => {
    offsets.push(pdf.length)
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`
  })

  const xrefStart = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const offset of offsets) {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`

  return new TextEncoder().encode(pdf).buffer as ArrayBuffer
}

describe('extractPdfText', () => {
  it('reads the text back out of a real PDF', async () => {
    const result = await extractPdfText(
      makePdf(['Cell membranes are selectively permeable.', 'Osmosis follows.'])
    )

    expect(result.text).toContain('Cell membranes are selectively permeable.')
    expect(result.text).toContain('Osmosis follows.')
    expect(result.pageCount).toBe(1)
  })

  it('keeps the line breaks the document actually has', async () => {
    // cleanText() downstream splits on newlines to find paragraphs, so losing
    // these would silently collapse every PDF into one run-on block.
    const result = await extractPdfText(makePdf(['First line', 'Second line']))

    expect(result.text).toMatch(/First line\s*\n\s*Second line/)
  })

  it('rejects something that is not a PDF instead of returning empty text', async () => {
    const notAPdf = new TextEncoder().encode('just some words')
      .buffer as ArrayBuffer

    await expect(extractPdfText(notAPdf)).rejects.toThrow()
  })

  it('survives a document with no text at all', async () => {
    const result = await extractPdfText(makePdf([]))

    expect(result.text.trim()).toBe('')
    expect(result.pageCount).toBe(1)
  })
})
