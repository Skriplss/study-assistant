/**
 * Lightweight, dependency-free relevance selection so we never send a whole
 * document to the model (Groq's free tier caps tokens-per-minute). Splits the
 * content into paragraphs, scores each by keyword overlap with the query, and
 * keeps the highest-scoring ones up to a character budget — in original order.
 */

const DEFAULT_MAX_CHARS = 12_000

function terms(text: string): string[] {
  return text.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? []
}

export function selectRelevantContent(
  content: string,
  query: string,
  maxChars: number = DEFAULT_MAX_CHARS
): string {
  if (!content) return ''
  if (content.length <= maxChars) return content

  const paragraphs = content
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)

  if (paragraphs.length <= 1) return content.slice(0, maxChars)

  const queryTerms = new Set(terms(query))
  const scored = paragraphs.map((p, index) => {
    let score = 0
    for (const w of terms(p)) if (queryTerms.has(w)) score++
    // Normalize by length so a huge paragraph doesn't win on raw count alone.
    return { p, index, score: score / Math.sqrt(p.length) }
  })

  const ranked = [...scored].sort((a, b) => b.score - a.score)

  const selected: typeof scored = []
  let total = 0
  for (const item of ranked) {
    if (total + item.p.length + 2 > maxChars) continue
    selected.push(item)
    total += item.p.length + 2
  }

  // No paragraph matched the query — fall back to the start of the document.
  if (selected.length === 0 || ranked[0].score === 0) {
    return content.slice(0, maxChars)
  }

  selected.sort((a, b) => a.index - b.index)
  return selected.map((s) => s.p).join('\n\n')
}
