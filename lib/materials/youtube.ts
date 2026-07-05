import { YoutubeTranscript } from 'youtube-transcript'

/** Extract the 11-char video id from any common YouTube URL form (or a bare id). */
export function extractYouTubeId(url: string): string | null {
  const trimmed = url.trim()
  const match = trimmed.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/
  )
  if (match) return match[1]
  if (/^[\w-]{11}$/.test(trimmed)) return trimmed
  return null
}

export function isYouTubeUrl(url: string): boolean {
  return extractYouTubeId(url) !== null
}

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&#39;': "'",
  '&quot;': '"',
  '&lt;': '<',
  '&gt;': '>',
  '&nbsp;': ' ',
}

function decodeEntities(text: string): string {
  return text.replace(/&amp;|&#39;|&quot;|&lt;|&gt;|&nbsp;/g, (m) => ENTITIES[m] ?? m)
}

/** Fetch a YouTube video's caption track and return it as plain text. */
export async function fetchYouTubeTranscript(
  url: string
): Promise<{ text: string; videoId: string }> {
  const videoId = extractYouTubeId(url)
  if (!videoId) throw new Error('Invalid YouTube URL')

  const segments = await YoutubeTranscript.fetchTranscript(videoId)
  const text = decodeEntities(segments.map((s) => s.text).join(' '))

  if (!text.trim()) throw new Error('No transcript available')
  return { text, videoId }
}
