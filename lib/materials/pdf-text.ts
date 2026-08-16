/**
 * PDF text extraction on a maintained pdf.js.
 *
 * This replaced `pdf-parse`, which has not been published since 2018 and carries
 * a copy of pdf.js from that era *inside the package* — so it cannot be patched
 * from the outside, and it is fed PDFs uploaded by users. The pdf.js line has had
 * arbitrary-code-execution bugs since (the most recent one is why officeparser's
 * copy is pinned in `overrides`), and in Node that code runs in our process.
 *
 * `unpdf` looks like the obvious swap and is not one: it vendors its own pdf.js
 * build, currently from the range the same advisory covers, where an override
 * cannot reach it either.
 */

/** Shape the caller needs — deliberately not pdf.js types, which leak everywhere. */
export interface PdfText {
  text: string
  pageCount: number
  /** Document properties (Title, Author, Producer…). Nothing reads the raw XMP,
   *  so it is dropped rather than carried around as an opaque blob. */
  info: unknown
}

/**
 * pdf.js is ~1.6MB. Loading it lazily keeps it off the cold start of every
 * request that isn't a PDF, which is most of them.
 */
async function loadPdfjs() {
  // The legacy build is the one meant for plain Node without a DOM.
  return import('pdfjs-dist/legacy/build/pdf.mjs')
}

export async function extractPdfText(buffer: ArrayBuffer): Promise<PdfText> {
  const pdfjs = await loadPdfjs()

  const task = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    // Both of these would have pdf.js reach out for resources a hostile document
    // names. Text extraction needs neither.
    //
    // There is deliberately no `isEvalSupported: false` here: v6 dropped the
    // option because it dropped the eval path it guarded — the build contains no
    // `new Function(` at all. Passing it would read as protection that isn't
    // doing anything.
    useSystemFonts: false,
    useWorkerFetch: false,
  })

  const doc = await task.promise

  try {
    const pages: string[] = []

    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
      const page = await doc.getPage(pageNumber)
      const content = await page.getTextContent()

      // pdf.js hands back positioned fragments, not lines. `hasEOL` is where it
      // decided the line ended — honouring it is what keeps paragraphs intact
      // for cleanText() further down.
      pages.push(
        content.items
          .map((item) =>
            'str' in item ? item.str + (item.hasEOL ? '\n' : '') : ''
          )
          .join('')
      )
    }

    const meta = await doc.getMetadata().catch(() => null)

    return {
      text: pages.join('\n\n'),
      pageCount: doc.numPages,
      info: meta?.info ?? null,
    }
  } finally {
    await task.destroy()
  }
}
