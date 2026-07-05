import 'server-only'

import { getSupabaseAdmin } from '@/lib/supabase/server'
import type { SearchResult, SearchFilters, StudyMaterial } from '@/lib/types'

export class SearchService {
  static async search(
    userId: string,
    query: string,
    filters?: SearchFilters
  ): Promise<SearchResult[]> {
    const db = getSupabaseAdmin()

    let dbQuery = db
      .from('study_materials')
      .select('*')
      .eq('user_id', userId)

    if (filters?.fileTypes && filters.fileTypes.length > 0) {
      dbQuery = dbQuery.in('file_type', filters.fileTypes)
    }

    if (filters?.categories && filters.categories.length > 0) {
      dbQuery = dbQuery.in('category', filters.categories)
    }

    // Push text matching into Postgres so we don't pull the whole library
    // (with full parsed_content) into Node on every search. Sanitize terms to
    // keep PostgREST's or() filter syntax intact.
    const terms = query
      .toLowerCase()
      .split(/\s+/)
      .map((t) => t.replace(/[%,()\\*]/g, ''))
      .filter((t) => t.length > 2)

    if (terms.length > 0) {
      const orFilter = terms
        .flatMap((t) => [`title.ilike.%${t}%`, `parsed_content.ilike.%${t}%`])
        .join(',')
      dbQuery = dbQuery.or(orFilter)
    }

    const { data: materials } = await dbQuery.limit(50)

    if (!materials) return []

    // Load tags for all materials
    const { data: allTags } = await db
      .from('material_tags')
      .select('material_id, tag')
      .in('material_id', materials.map(m => m.id))

    const tagsByMaterial = new Map<string, string[]>()
    allTags?.forEach(t => {
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
        parsedContent: m.parsed_content,
        parsingStatus: m.parsing_status as 'pending' | 'processing' | 'completed' | 'failed',
        parsingError: m.parsing_error,
        category: m.category,
        tags: materialTags,
        language: m.language,
        createdAt: m.created_at || new Date().toISOString(),
        updatedAt: m.updated_at || new Date().toISOString(),
      }

      const score = this.calculateRelevance(material, query, filters)
      
      if (score > 0) {
        results.push({
          material,
          relevanceScore: score,
          matchedTerms: this.extractMatchedTerms(material, query),
          snippet: this.generateSnippet(material, query),
        })
      }
    }

    return results.sort((a, b) => b.relevanceScore - a.relevanceScore)
  }

  private static calculateRelevance(
    material: StudyMaterial,
    query: string,
    filters?: SearchFilters
  ): number {
    const terms = query.toLowerCase().split(' ').filter(t => t.length > 2)
    let score = 0

    const title = material.title.toLowerCase()
    const content = (material.parsedContent || '').toLowerCase()
    const tags = material.tags || []

    for (const term of terms) {
      if (title.includes(term)) score += 10
      if (content.includes(term)) score += 5
      if (tags.some(tag => tag.toLowerCase().includes(term))) score += 15
    }

    if (filters?.tags && filters.tags.length > 0) {
      const matchedTags = tags.filter(t => filters.tags?.includes(t))
      score += matchedTags.length * 20
    }

    return score
  }

  private static extractMatchedTerms(material: StudyMaterial, query: string): string[] {
    const terms = query.toLowerCase().split(' ').filter(t => t.length > 2)
    const matched: string[] = []

    const title = material.title.toLowerCase()
    const content = (material.parsedContent || '').toLowerCase()
    const tags = material.tags || []

    for (const term of terms) {
      if (title.includes(term) || content.includes(term) || 
          tags.some(tag => tag.toLowerCase().includes(term))) {
        matched.push(term)
      }
    }

    return [...new Set(matched)]
  }

  private static generateSnippet(material: StudyMaterial, query: string): string {
    const content = material.parsedContent || material.title
    const terms = query.toLowerCase().split(' ').filter(t => t.length > 2)
    
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
