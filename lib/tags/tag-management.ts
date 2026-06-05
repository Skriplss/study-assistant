const MAX_TAG_LENGTH = 50
const TAG_PATTERN = /^[a-z0-9][a-z0-9-_\s]*[a-z0-9]$|^[a-z0-9]$/

export interface TagEntry {
  tag: string
  count?: number
}

/**
 * Normalize a tag for storage and comparison.
 */
export function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase().replace(/\s+/g, '-')
}

/**
 * Validate tag format and length.
 */
export function validateTag(tag: string): { valid: boolean; error?: string } {
  const normalized = normalizeTag(tag)
  if (!normalized) {
    return { valid: false, error: 'Tag cannot be empty' }
  }
  if (normalized.length > MAX_TAG_LENGTH) {
    return {
      valid: false,
      error: `Tag must be at most ${MAX_TAG_LENGTH} characters`,
    }
  }
  if (!TAG_PATTERN.test(normalized)) {
    return {
      valid: false,
      error: 'Tag may only contain letters, numbers, hyphens, and underscores',
    }
  }
  return { valid: true }
}

/**
 * Check if a tag already exists in the current selection (case-insensitive).
 */
export function isDuplicateTag(tag: string, existingTags: string[]): boolean {
  const normalized = normalizeTag(tag)
  return existingTags.some((t) => normalizeTag(t) === normalized)
}

/**
 * Add a tag if valid and not duplicate.
 */
export function addTag(
  tag: string,
  existingTags: string[]
): { tags: string[]; error?: string } {
  const validation = validateTag(tag)
  if (!validation.valid) {
    return { tags: existingTags, error: validation.error }
  }
  const normalized = normalizeTag(tag)
  if (isDuplicateTag(normalized, existingTags)) {
    return { tags: existingTags, error: 'Tag already added' }
  }
  return { tags: [...existingTags, normalized] }
}

/**
 * Remove a tag by value.
 */
export function removeTag(tag: string, existingTags: string[]): string[] {
  const normalized = normalizeTag(tag)
  return existingTags.filter((t) => normalizeTag(t) !== normalized)
}

/**
 * Filter tag suggestions for autocomplete based on query and already selected tags.
 */
export function getTagSuggestions(
  query: string,
  availableTags: TagEntry[],
  selectedTags: string[],
  limit = 8
): string[] {
  const q = normalizeTag(query)
  const selected = new Set(selectedTags.map(normalizeTag))

  return availableTags
    .map((entry) => normalizeTag(entry.tag))
    .filter((tag) => !selected.has(tag))
    .filter((tag) => !q || tag.includes(q))
    .slice(0, limit)
}

/**
 * Filter category suggestions for autocomplete.
 */
export function getCategorySuggestions(
  query: string,
  availableCategories: string[],
  limit = 8
): string[] {
  const q = query.trim().toLowerCase()
  const seen = new Set<string>()

  return availableCategories
    .map((c) => c.trim())
    .filter((c) => c.length > 0)
    .filter((c) => {
      const key = c.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .filter((c) => !q || c.toLowerCase().includes(q))
    .slice(0, limit)
}
