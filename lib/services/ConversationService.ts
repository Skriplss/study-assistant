import 'server-only'

import { getSupabaseAdmin } from '@/lib/supabase/server'
import { ApiError } from '@/lib/api/errors'
import type { Json } from '@/lib/supabase/database.types'
import type { ChatMessageRecord, ConversationSummary } from '@/lib/types'
import type { ChatSource } from './GlobalChatService'

const TITLE_MAX_LENGTH = 60

export class ConversationService {
  /** First question doubles as the title — trimmed at a word boundary. */
  private static titleFrom(message: string): string {
    const clean = message.trim().replace(/\s+/g, ' ')
    if (clean.length <= TITLE_MAX_LENGTH) return clean

    const cut = clean.slice(0, TITLE_MAX_LENGTH)
    const lastSpace = cut.lastIndexOf(' ')
    return `${lastSpace > 20 ? cut.slice(0, lastSpace) : cut}…`
  }

  static async create(
    userId: string,
    firstMessage: string,
    materialId?: string
  ): Promise<string> {
    const db = getSupabaseAdmin()

    const { data, error } = await db
      .from('conversations')
      .insert({
        user_id: userId,
        material_id: materialId ?? null,
        title: this.titleFrom(firstMessage),
      })
      .select('id')
      .single()

    if (error || !data) throw new Error(error?.message || 'Failed to create conversation')
    return data.id
  }

  /**
   * Confirms the conversation belongs to the user. Every write goes through
   * this — the service-role client bypasses RLS, so ownership is our job.
   */
  static async assertOwned(userId: string, conversationId: string): Promise<void> {
    const db = getSupabaseAdmin()

    const { data } = await db
      .from('conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('user_id', userId)
      .single()

    if (!data) throw new ApiError('Conversation not found', 404)
  }

  static async appendMessage(
    conversationId: string,
    role: 'user' | 'assistant',
    content: string,
    sources?: ChatSource[]
  ): Promise<void> {
    const db = getSupabaseAdmin()

    const { error } = await db.from('messages').insert({
      conversation_id: conversationId,
      role,
      content,
      // ChatSource is an interface, so it has no implicit index signature and
      // won't structurally match Json even though its shape is valid JSON.
      sources: sources?.length ? (sources as unknown as Json) : null,
    })

    if (error) throw new Error(`Failed to save message: ${error.message}`)

    // Touch the parent so the sidebar orders by real activity, not creation.
    await db
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId)
  }

  static async list(userId: string): Promise<ConversationSummary[]> {
    const db = getSupabaseAdmin()

    const { data, error } = await db
      .from('conversations')
      .select('id, title, material_id, created_at, updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(100)

    if (error) throw new Error(error.message)

    return (data || []).map(row => ({
      id: row.id,
      title: row.title,
      materialId: row.material_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }))
  }

  static async getMessages(
    userId: string,
    conversationId: string
  ): Promise<ChatMessageRecord[]> {
    await this.assertOwned(userId, conversationId)

    const db = getSupabaseAdmin()
    const { data, error } = await db
      .from('messages')
      .select('id, role, content, sources, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at')

    if (error) throw new Error(error.message)

    return (data || []).map(row => ({
      id: row.id,
      role: row.role as ChatMessageRecord['role'],
      content: row.content,
      sources: Array.isArray(row.sources) ? (row.sources as unknown as ChatSource[]) : null,
      createdAt: row.created_at,
    }))
  }

  static async remove(userId: string, conversationId: string): Promise<void> {
    await this.assertOwned(userId, conversationId)

    const db = getSupabaseAdmin()
    // messages cascade on the FK.
    const { error } = await db.from('conversations').delete().eq('id', conversationId)

    if (error) throw new Error(error.message)
  }
}
