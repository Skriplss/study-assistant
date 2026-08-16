import 'server-only'

import { getSupabaseAdmin } from '@/lib/supabase/server'
import type { SearchResult, SearchFilters, StudyMaterial } from '@/lib/types'

const SEARCHABLE_COLUMNS =
  'id, user_id, title, file_name, file_type, file_size, file_path, source_url, parsing_status, parsing_error, category, language, created_at, updated_at'

export class SearchService {
  static async search(
    userId: string,
    query: string,
    filters?: SearchFilters
  ): Promise<SearchResult[]> {
    const db = getSupabaseAdmin()

    // Every column except parsed_content, which runs to megabytes per row. With
    // `.limit(50)` a single search — and every chat message, which ranks through
    // here — pulled the whole library into Node to score it and then dropped it:
    // measured at 1.72MB for five materials, against 989 bytes for the same query
    // without the column.
    //
    // Matching is unaffected: the ilike below runs in Postgres, so a row whose
    // text matches only deep inside the document still comes back.
    let dbQuery = db
      .from('study_materials')
      .select(SEARCHABLE_COLUMNS)
      .eq('user_id', userId)

    if (filters?.fileTypes && filters.fileTypes.length > 0) {
      dbQuery = dbQuery.in('file_type', filters.fileTypes)
    }

    if (filters?.categories && filters.categories.length > 0) {
      dbQuery = dbQuery.in('category', filters.categories)
    }

    // Push text matching into Postgres so we don't pull the whole library
    // (with full parsed_content) into Node on every search.
    const terms = query
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 2)

    if (terms.length > 0) {
      // Quote the value rather than stripping characters out of it. A denylist of
      // syntax characters is a bet that the list is complete; quoting is how
      // PostgREST is specified to take a value containing commas or parens, and
      // it keeps the user's search term intact instead of silently editing it.
      const quote = (term: string) =>
        `"%${term.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}%"`

      const orFilter = terms
        .flatMap((t) => [
          `title.ilike.${quote(t)}`,
          `parsed_content.ilike.${quote(t)}`,
        ])
        .join(',')
      dbQuery = dbQuery.or(orFilter)
    }

    // A dropped error here reads as "no matches" — and this same call is how the
    // chat picks which of your materials to answer from, so a broken query
    // silently downgraded chat to "whatever you uploaded last" and answered from
    // the wrong documents with nothing to show for it.
    const { data: materials, error } = await dbQuery.limit(50)

    if (error) {
      throw new Error(`Search failed: ${error.message}`)
    }

    if (!materials) return []

    // Load tags for all materials
    const { data: allTags } = await db
      .from('material_tags')
      .select('material_id, tag')
      .in(
        'material_id',
        materials.map((m) => m.id)
      )

    const tagsByMaterial = new Map<string, string[]>()
    allTags?.forEach((t) => {
      if (!tagsByMaterial.has(t.material_id)) {
        tagsByMaterial.set(t.material_id, [])
      }
      tagsByMaterial.get(t.material_id)!.push(t.tag)
    })

    const results: SearchResult[] = []

    for (const m of materials) {
      const materialTags = tagsByMaterial.get(m.id) || []
      const material: StudyMaterial = {
        id: m.id,
        userId: m.user_id,
        title: m.title,
        fileName: m.file_name,
        fileType: m.file_type as StudyMaterial['fileType'],
        fileSize: m.file_size,
        filePath: m.file_path,
        sourceUrl: m.source_url ?? null,
        // Not selected — callers that need the text fetch it for the handful of
        // materials they actually keep (see GlobalChatService.rankBySearch).
        parsedContent: null,
        parsingStatus: m.parsing_status as
          | 'pending'
          | 'processing'
          | 'completed'
          | 'failed',
        parsingError: m.parsing_error,
        category: m.category,
        tags: materialTags,
        language: m.language,
        createdAt: m.created_at || new Date().toISOString(),
        updatedAt: m.updated_at || new Date().toISOString(),
      }

      // Floor of 1, not a `score > 0` gate. Postgres has already established
      // that this row matches — dropping the ones that score zero here would
      // discard every material whose only match is inside the document text,
      // which is most of them now that the text is no longer loaded to score.
      results.push({
        material,
        relevanceScore: Math.max(
          1,
          this.calculateRelevance(material, query, filters)
        ),
        matchedTerms: this.extractMatchedTerms(material, query),
        snippet: this.generateSnippet(material, query),
      })
    }

    return results.sort((a, b) => b.relevanceScore - a.relevanceScore)
  }

  /** Significant search terms (>2 chars) from a raw query. */
  private static queryTerms(query: string): string[] {
    return query
      .toLowerCase()
      .split(' ')
      .filter((t) => t.length > 2)
  }

  private static calculateRelevance(
    material: StudyMaterial,
    query: string,
    filters?: SearchFilters
  ): number {
    const terms = this.queryTerms(query)
    let score = 0

    const title = material.title.toLowerCase()
    const tags = material.tags || []

    // No content term here: the document text isn't loaded any more. What it
    // used to contribute (+5 per term) is now expressed by the floor the caller
    // applies — a body-only match ranks below any title or tag match, which is
    // the ordering the +5 produced anyway.
    for (const term of terms) {
      if (title.includes(term)) score += 10
      if (tags.some((tag) => tag.toLowerCase().includes(term))) score += 15
    }

    if (filters?.tags && filters.tags.length > 0) {
      const matchedTags = tags.filter((t) => filters.tags?.includes(t))
      score += matchedTags.length * 20
    }

    return score
  }

  private static extractMatchedTerms(
    material: StudyMaterial,
    query: string
  ): string[] {
    const terms = this.queryTerms(query)
    const matched: string[] = []

    const title = material.title.toLowerCase()
    const content = (material.parsedContent || '').toLowerCase()
    const tags = material.tags || []

    for (const term of terms) {
      if (
        title.includes(term) ||
        content.includes(term) ||
        tags.some((tag) => tag.toLowerCase().includes(term))
      ) {
        matched.push(term)
      }
    }

    return [...new Set(matched)]
  }

  private static generateSnippet(
    material: StudyMaterial,
    query: string
  ): string {
    const content = material.parsedContent || material.title
    const terms = this.queryTerms(query)

    for (const term of terms) {
      const index = content.toLowerCase().indexOf(term)
      if (index !== -1) {
        const start = Math.max(0, index - 60)
        const end = Math.min(content.length, index + 100)
        let snippet = content.substring(start, end)

        if (start > 0) snippet = '...' + snippet
        if (end < content.length) snippet = snippet + '...'

        return snippet
      }
    }

    return content.substring(0, 150) + '...'
  }
}
