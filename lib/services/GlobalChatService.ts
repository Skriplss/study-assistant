import 'server-only'

import { getSupabaseAdmin } from '@/lib/supabase/server'
import { SearchService } from './SearchService'
import { selectRelevantContent } from '@/lib/ai/context'

export interface ChatSource {
  id: string
  title: string
}

export interface ChatContext {
  context: string
  sources: ChatSource[]
}

const MAX_SOURCES = 4
/**
 * Chars of source text per question, measured against Groq's 8k tokens-per-minute
 * ceiling for LARGE_MODEL (~3.9 chars/token on this content). The sources are
 * re-sent every turn, so this is the dominant recurring cost: at 14k chars a
 * single question spent ~5.7k TPM and the *next* one 429'd for ~25s. At 7k,
 * two questions land back-to-back before the window runs out.
 */
const TOTAL_BUDGET = 7_000

export class GlobalChatService {
  /**
   * Pick the materials most relevant to the question and build a bounded,
   * source-labelled context block for the model. Keyword retrieval (SearchService
   * + selectRelevantContent) — no embeddings, matching the rest of the app.
   */
  static async buildContext(
    userId: string,
    message: string,
    materialId?: string
  ): Promise<ChatContext> {
    // Scoped to a single material (from the chat's scope selector / deep link).
    if (materialId) {
      const one = await this.oneMaterial(userId, materialId)
      if (!one) return { context: '', sources: [] }
      const passage = selectRelevantContent(one.content, message, TOTAL_BUDGET)
      if (!passage) return { context: '', sources: [] }
      return {
        context: `[Source 1: ${one.title}]\n${passage}`,
        sources: [{ id: one.id, title: one.title }],
      }
    }

    let picked = await this.rankBySearch(userId, message)

    // No keyword hits (e.g. "summarize what I've studied") — fall back to the
    // user's most recent parsed materials so the chat still has something to work with.
    if (picked.length === 0) {
      picked = await this.recentMaterials(userId)
    }

    if (picked.length === 0) {
      return { context: '', sources: [] }
    }

    const perMaterial = Math.floor(TOTAL_BUDGET / picked.length)
    const blocks: string[] = []
    const sources: ChatSource[] = []

    picked.forEach(m => {
      const passage = selectRelevantContent(m.content, message, perMaterial)
      if (!passage) return
      sources.push({ id: m.id, title: m.title })
      blocks.push(`[Source ${sources.length}: ${m.title}]\n${passage}`)
    })

    return { context: blocks.join('\n\n---\n\n'), sources }
  }

  private static async rankBySearch(
    userId: string,
    message: string
  ): Promise<{ id: string; title: string; content: string }[]> {
    const results = await SearchService.search(userId, message)
    return results
      .filter(r => r.material.parsedContent)
      .slice(0, MAX_SOURCES)
      .map(r => ({
        id: r.material.id,
        title: r.material.title,
        content: r.material.parsedContent as string,
      }))
  }

  private static async oneMaterial(
    userId: string,
    materialId: string
  ): Promise<{ id: string; title: string; content: string } | null> {
    const db = getSupabaseAdmin()
    const { data } = await db
      .from('study_materials')
      .select('id, title, parsed_content')
      .eq('id', materialId)
      .eq('user_id', userId)
      .eq('parsing_status', 'completed')
      .single()

    if (!data?.parsed_content) return null
    return { id: data.id, title: data.title, content: data.parsed_content as string }
  }

  private static async recentMaterials(
    userId: string
  ): Promise<{ id: string; title: string; content: string }[]> {
    const db = getSupabaseAdmin()
    const { data } = await db
      .from('study_materials')
      .select('id, title, parsed_content')
      .eq('user_id', userId)
      .eq('parsing_status', 'completed')
      .not('parsed_content', 'is', null)
      .order('created_at', { ascending: false })
      .limit(MAX_SOURCES)

    return (data ?? []).map(m => ({
      id: m.id,
      title: m.title,
      content: m.parsed_content as string,
    }))
  }
}
