import 'server-only'

import { getSupabaseAdmin } from '@/lib/supabase/server'
import { AIService } from './AIService'
import type { KnowledgeGraph, GraphNode, GraphEdge } from '@/lib/types'

export class GraphService {
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

    const tagsByMaterial = new Map<string, string[]>()
    allTags?.forEach(t => {
      if (!tagsByMaterial.has(t.material_id)) {
        tagsByMaterial.set(t.material_id, [])
      }
      tagsByMaterial.get(t.material_id)!.push(t.tag)
    })

    // Extract each material's concepts ONCE (n AI calls, bounded concurrency),
    // then compute pairwise overlap in code. The old approach ran one AI call
    // per pair — n(n-1)/2 sequential requests, which timed out at any scale.
    const withContent = materials.filter((m) => m.parsed_content)
    const conceptsById = new Map<string, string[]>()
    await this.mapLimit(withContent, 4, async (m) => {
      conceptsById.set(m.id, await this.extractConcepts(m.parsed_content as string, m.title))
    })

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

        const c2 = new Set(conceptsById.get(m2.id) || [])
        const sharedConcepts = (conceptsById.get(m1.id) || []).filter((c) => c2.has(c))
        if (sharedConcepts.length === 0) continue

        const tags1 = tagsByMaterial.get(m1.id) || []
        const tags2 = tagsByMaterial.get(m2.id) || []
        connections.push({
          user_id: userId,
          material_id_1: m1.id,
          material_id_2: m2.id,
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

  /** Run an async fn over items with a bounded number of concurrent workers. */
  private static async mapLimit<T>(
    items: T[],
    limit: number,
    fn: (item: T) => Promise<void>
  ): Promise<void> {
    let cursor = 0
    const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (cursor < items.length) {
        await fn(items[cursor++])
      }
    })
    await Promise.all(workers)
  }

  /** Extract a normalized set of key concepts for one material (single AI call). */
  private static async extractConcepts(content: string, title: string): Promise<string[]> {
    const prompt = `Extract the 8-12 most important concepts or topics from this study material as a JSON array of short lowercase strings. Title: ${title}

Content:
${content.substring(0, 3000)}

Return only a JSON array, e.g. ["concept a", "concept b"]`

    try {
      const response = await AIService.chat([{ role: 'user', content: prompt }], {
        temperature: 0.2,
        maxTokens: 300,
      })

      const parsed = JSON.parse((response || '[]').replace(/```json\n?|\n?```/g, ''))
      if (!Array.isArray(parsed)) return []
      return parsed
        .map((c) => String(c).toLowerCase().trim())
        .filter(Boolean)
        .slice(0, 12)
    } catch {
      return []
    }
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
