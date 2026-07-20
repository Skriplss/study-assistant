import 'server-only'

import { getSupabaseAdmin } from '@/lib/supabase/server'
import { AIService } from './AIService'
import { prepareContent } from '@/lib/ai/quiz-prompt'
import type { KnowledgeGraph, GraphNode, GraphEdge } from '@/lib/types'

export class GraphService {
  // Generic filler words that would otherwise create spurious concept matches.
  private static readonly STOPWORDS = new Set([
    'the', 'a', 'an', 'of', 'and', 'to', 'in', 'for', 'with', 'on', 'or', 'as',
    'by', 'is', 'are', 'introduction', 'intro', 'basics', 'basic', 'overview',
    'concept', 'concepts', 'fundamentals', 'fundamental', 'principle',
    'principles', 'general', 'topic', 'topics', 'study', 'material', 'guide',
  ])

  static async analyzeConnections(userId: string): Promise<void> {
    const db = getSupabaseAdmin()
    
    const { data: materials } = await db
      .from('study_materials')
      .select('id, title, parsed_content, category')
      .eq('user_id', userId)
      .eq('parsing_status', 'completed')

    if (!materials || materials.length < 2) return

    // Load tags for all materials
    const { data: allTags } = await db
      .from('material_tags')
      .select('material_id, tag')
      .in('material_id', materials.map(m => m.id))

    const tagsByMaterial = this.groupTags(allTags)

    // Extract each material's concepts ONCE, then compute pairwise overlap in
    // code. The old approach ran one AI call per pair — n(n-1)/2 requests, which
    // timed out at any scale. Sequential, not concurrent: Groq's free tier is
    // ~6000 tokens/minute (shared across the whole org), so parallel extractions
    // just trigger 429 storms that burn the retry budget and return empty
    // concept sets. One at a time lets the token bucket refill between calls.
    const withContent = materials.filter((m) => m.parsed_content)
    const conceptsById = new Map<string, string[]>()
    for (const m of withContent) {
      conceptsById.set(m.id, await this.extractConcepts(m.parsed_content as string, m.title))
    }

    const connections: {
      user_id: string
      material_id_1: string
      material_id_2: string
      connection_strength: number
      shared_concepts: string[]
    }[] = []

    for (let i = 0; i < withContent.length; i++) {
      for (let j = i + 1; j < withContent.length; j++) {
        const m1 = withContent[i]
        const m2 = withContent[j]

        const sharedConcepts = this.sharedConcepts(
          conceptsById.get(m1.id) || [],
          conceptsById.get(m2.id) || []
        )
        if (sharedConcepts.length === 0) continue

        const tags1 = tagsByMaterial.get(m1.id) || []
        const tags2 = tagsByMaterial.get(m2.id) || []
        // material_connections enforces CHECK (material_id_1 < material_id_2),
        // so the pair must be stored in id order — array order won't do.
        const [id1, id2] = m1.id < m2.id ? [m1.id, m2.id] : [m2.id, m1.id]
        connections.push({
          user_id: userId,
          material_id_1: id1,
          material_id_2: id2,
          connection_strength: this.calculateStrength(sharedConcepts, tags1, tags2),
          shared_concepts: sharedConcepts,
        })
      }
    }

    if (connections.length > 0) {
      await db.from('material_connections').upsert(connections, {
        onConflict: 'material_id_1,material_id_2',
      })
    }
  }

  /** Group tag rows into a materialId → tags[] map. */
  private static groupTags(
    rows: { material_id: string; tag: string }[] | null
  ): Map<string, string[]> {
    const byMaterial = new Map<string, string[]>()
    rows?.forEach((t) => {
      if (!byMaterial.has(t.material_id)) byMaterial.set(t.material_id, [])
      byMaterial.get(t.material_id)!.push(t.tag)
    })
    return byMaterial
  }

  /** Extract a normalized set of key concepts for one material (single AI call). */
  private static async extractConcepts(content: string, title: string): Promise<string[]> {
    // Sample across the WHOLE material, not just the intro, so concepts reflect
    // the full document.
    const prompt = `Extract the 8-12 most important concepts or topics from this study material as a JSON array of short lowercase strings. Title: ${title}

Content:
${prepareContent(content, 6_000)}

Return only a JSON array, e.g. ["concept a", "concept b"]`

    try {
      const response = await AIService.chat([{ role: 'user', content: prompt }], {
        temperature: 0.2,
        // The array plus thinking measures ~60 tokens. Thinking is spent before
        // any content, so this can't go near zero (that returns "" rather than
        // an error) — but max_tokens is billed against TPM up front, so it
        // shouldn't be fat either. 800 is ~13x the measured need.
        maxTokens: 800,
      })

      // The model may wrap the array in prose — pull out the first JSON array.
      const match = (response || '').match(/\[[\s\S]*\]/)
      const parsed = JSON.parse(match ? match[0] : '[]')
      if (!Array.isArray(parsed)) return []
      return parsed
        .map((c) => String(c).toLowerCase().trim())
        .filter(Boolean)
        .slice(0, 12)
    } catch {
      return []
    }
  }

  /** Significant, comparable tokens within one concept phrase. */
  private static conceptTokens(concept: string): string[] {
    return concept
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .split(' ')
      .map((t) => t.trim())
      .filter((t) => t.length >= 3 && !this.STOPWORDS.has(t))
  }

  /**
   * Concepts from two materials that overlap. Matches on an exact phrase OR a
   * shared significant token, so "python programming" and "python basics" link
   * via "python" instead of requiring identical strings.
   */
  private static sharedConcepts(a: string[], b: string[]): string[] {
    const bPrepared = b.map((phrase) => ({
      phrase,
      norm: phrase.trim().toLowerCase(),
      tokens: new Set(this.conceptTokens(phrase)),
    }))

    const shared = new Set<string>()
    for (const p1 of a) {
      const norm1 = p1.trim().toLowerCase()
      const tokens1 = this.conceptTokens(p1)
      for (const b2 of bPrepared) {
        const match =
          norm1 === b2.norm || tokens1.some((t) => b2.tokens.has(t))
        if (match) {
          // Prefer an exact match; otherwise keep the shorter, more general label.
          shared.add(norm1 === b2.norm ? p1 : p1.length <= b2.phrase.length ? p1 : b2.phrase)
        }
      }
    }
    return [...shared]
  }

  private static calculateStrength(
    concepts: string[],
    tags1: string[],
    tags2: string[]
  ): number {
    const conceptScore = Math.min(concepts.length / 10, 0.7)
    
    const sharedTags = tags1.filter(t => tags2.includes(t))
    const tagScore = Math.min(sharedTags.length / 5, 0.3)

    return Math.min(conceptScore + tagScore, 1.0)
  }

  static async getGraph(userId: string): Promise<KnowledgeGraph> {
    const db = getSupabaseAdmin()

    const [{ data: materials }, { data: connections }] = await Promise.all([
      db.from('study_materials').select('id, title, category').eq('user_id', userId),
      db
        .from('material_connections')
        .select('material_id_1, material_id_2, connection_strength, shared_concepts')
        .eq('user_id', userId),
    ])

    if (!materials) {
      return { nodes: [], edges: [] }
    }

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

    const nodes: GraphNode[] = materials.map(m => ({
      id: m.id,
      label: m.title,
      type: 'material' as const,
      data: {
        materialId: m.id,
        title: m.title,
        category: m.category,
        tags: tagsByMaterial.get(m.id) || [],
      },
    }))

    const edges: GraphEdge[] = (connections || []).map(c => ({
      id: `${c.material_id_1}-${c.material_id_2}`,
      source: c.material_id_1,
      target: c.material_id_2,
      strength: c.connection_strength,
      sharedConcepts: Array.isArray(c.shared_concepts) ? c.shared_concepts as string[] : [],
    }))

    return { nodes, edges }
  }
}
