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

    const connections: {
      user_id: string
      material_id_1: string
      material_id_2: string
      connection_strength: number
      shared_concepts: string[]
    }[] = []

    for (let i = 0; i < materials.length; i++) {
      for (let j = i + 1; j < materials.length; j++) {
        const m1 = materials[i]
        const m2 = materials[j]

        if (!m1.parsed_content || !m2.parsed_content) continue

        const sharedConcepts = await this.extractSharedConcepts(
          m1.parsed_content,
          m2.parsed_content
        )

        if (sharedConcepts.length > 0) {
          const tags1 = tagsByMaterial.get(m1.id) || []
          const tags2 = tagsByMaterial.get(m2.id) || []
          const strength = this.calculateStrength(sharedConcepts, tags1, tags2)
          
          connections.push({
            user_id: userId,
            material_id_1: m1.id,
            material_id_2: m2.id,
            connection_strength: strength,
            shared_concepts: sharedConcepts,
          })
        }
      }
    }

    if (connections.length > 0) {
      await db.from('material_connections').upsert(connections, {
        onConflict: 'material_id_1,material_id_2',
      })
    }
  }

  private static async extractSharedConcepts(
    content1: string,
    content2: string
  ): Promise<string[]> {
    const text1 = content1.substring(0, 2000)
    const text2 = content2.substring(0, 2000)

    const prompt = `Extract shared concepts between these two texts. Return only a JSON array of concept strings.

Text 1: ${text1}

Text 2: ${text2}

Return format: ["concept1", "concept2", ...]`

    try {
      // Try Gemini first, fallback to Groq
      let response: string | null | undefined
      try {
        console.log('Using Gemini')
        response = await AIService['callWithRetry'](async () => {
          const gemini = AIService['getGeminiClient']()
          const model = gemini.getGenerativeModel({ model: 'gemini-2.0-flash' })
          const result = await model.generateContent(prompt)
          return result.response.text()
        })
      } catch (error) {
        console.log('Falling back to Groq')
        response = await AIService['callWithRetry'](async () => {
          const client = AIService['getGroqClient']()
          const res = await client.chat.completions.create({
            model: 'llama-3.1-8b-instant',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.3,
            max_tokens: 500,
          })
          return res.choices[0]?.message?.content || '[]'
        })
      }

      const parsed = JSON.parse((response || '[]').replace(/```json\n?|\n?```/g, ''))
      return Array.isArray(parsed) ? parsed.slice(0, 10) : []
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

    const { data: materials } = await db
      .from('study_materials')
      .select('id, title, category')
      .eq('user_id', userId)

    const { data: connections } = await db
      .from('material_connections')
      .select('*')

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
