import { franc } from 'franc'

const LANGUAGE_NAMES: Record<string, string> = {
  sk: 'Slovak',
  uk: 'Ukrainian',
  en: 'English',
  de: 'German',
  pl: 'Polish',
  cs: 'Czech',
  ru: 'Russian',
  es: 'Spanish',
  fr: 'French',
  it: 'Italian',
  pt: 'Portuguese',
  nl: 'Dutch',
  sv: 'Swedish',
  no: 'Norwegian',
  da: 'Danish',
  fi: 'Finnish',
}

/**
 * Detect the language of a given text using smart sampling
 * @param text - The text to analyze
 * @returns ISO 639-1 language code (e.g., 'en', 'sk', 'uk')
 */
export function detectMaterialLanguage(text: string): string {
  if (!text || text.trim().length < 100) {
    return 'en' // Default fallback
  }

  const cleanText = text.trim()
  const chunkSize = 500
  const minChunkLength = 100
  const chunks: string[] = []

  // Split text into chunks of ~500 characters
  for (let i = 0; i < cleanText.length; i += chunkSize) {
    const chunk = cleanText.slice(i, i + chunkSize)
    if (chunk.length >= minChunkLength) {
      chunks.push(chunk)
    }
  }

  // If we don't have enough chunks, use the whole text
  if (chunks.length === 0) {
    const detected = franc(cleanText, { minLength: minChunkLength })
    return normalizeLanguageCode(detected)
  }

  // Detect language for each chunk
  const languageCounts: Record<string, number> = {}

  for (const chunk of chunks) {
    const detected = franc(chunk, { minLength: minChunkLength })
    const normalized = normalizeLanguageCode(detected)

    if (normalized !== 'und') {
      languageCounts[normalized] = (languageCounts[normalized] || 0) + 1
    }
  }

  // Find the most frequent language (majority vote)
  let maxCount = 0
  let mostFrequentLanguage = 'en'

  for (const [lang, count] of Object.entries(languageCounts)) {
    if (count > maxCount) {
      maxCount = count
      mostFrequentLanguage = lang
    }
  }

  // If no language was detected or confidence is too low, fallback to English
  if (maxCount === 0 || mostFrequentLanguage === 'und') {
    return 'en'
  }

  return mostFrequentLanguage
}

/**
 * Normalize language code from franc (ISO 639-3) to ISO 639-1
 * @param francCode - The language code returned by franc
 * @returns ISO 639-1 code or 'und' if unknown
 */
function normalizeLanguageCode(francCode: string): string {
  // franc returns ISO 639-3 codes, we need ISO 639-1
  // Map common ISO 639-3 to ISO 639-1
  const iso639_3_to_1: Record<string, string> = {
    eng: 'en',
    slk: 'sk',
    ukr: 'uk',
    deu: 'de',
    pol: 'pl',
    ces: 'cs',
    rus: 'ru',
    spa: 'es',
    fra: 'fr',
    ita: 'it',
    por: 'pt',
    nld: 'nl',
    swe: 'sv',
    nor: 'no',
    dan: 'da',
    fin: 'fi',
  }

  return iso639_3_to_1[francCode] || (francCode === 'und' ? 'und' : 'en')
}

/**
 * Get the full language name from ISO 639-1 code
 * @param code - ISO 639-1 language code
 * @returns Full language name or the code itself if not found
 */
export function getLanguageName(code: string): string {
  return LANGUAGE_NAMES[code] || code
}
