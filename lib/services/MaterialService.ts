import 'server-only'
 
import { getSupabaseAdmin } from '@/lib/supabase/server'
import {
  validateMaterialFile,
  validateMaterialUpload,
} from '@/lib/materials/file-validation'
import type { StudyMaterial, MaterialMetadata } from '@/lib/types'

type FileType = StudyMaterial['fileType']
type LinkType = 'youtube' | 'url'
type ParsingStatus = 'pending' | 'processing' | 'completed' | 'failed'

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** The caller sent something bad — routes map this to a 400 rather than a 500. */
export class MaterialValidationError extends Error {
  constructor(message = 'Invalid upload') {
    super(message)
    this.name = 'MaterialValidationError'
  }
}
 
function mapMaterial(material: any, tags: string[]): StudyMaterial {
  return {
    id: material.id,
    userId: material.user_id,
    title: material.title,
    fileName: material.file_name,
    fileType: material.file_type as FileType,
    fileSize: material.file_size,
    filePath: material.file_path ?? null,
    sourceUrl: material.source_url ?? null,
    parsedContent: material.parsed_content ?? null,
    parsingStatus: (material.parsing_status ?? 'pending') as ParsingStatus,
    parsingError: material.parsing_error,
    category: material.category,
    tags,
    language: material.language,
    createdAt: material.created_at,
    updatedAt: material.updated_at,
  }
}
 
export class MaterialService {
  private static readonly STORAGE_BUCKET = 'study-materials'
 
  static validateFile(file: File): { valid: boolean; error?: string } {
    return validateMaterialFile(file)
  }
 
  /**
   * Reserve a storage path and hand the browser a signed URL to upload to directly.
   * Bytes must never transit the API route: Vercel rejects request bodies over 4.5MB
   * at the edge, before the handler is even invoked.
   */
  static async createUploadTarget(
    userId: string,
    fileName: string,
    fileSize: number
  ): Promise<{
    materialId: string
    filePath: string
    token: string
    bucket: string
  }> {
    const validation = validateMaterialUpload(fileName, fileSize)
    if (!validation.valid) {
      throw new MaterialValidationError(validation.error)
    }

    const db = getSupabaseAdmin()
    const fileExtension = fileName.split('.').pop()!.toLowerCase()
    const materialId = crypto.randomUUID()
    const filePath = `${userId}/${materialId}/original.${fileExtension}`

    const { data, error } = await db.storage
      .from(this.STORAGE_BUCKET)
      .createSignedUploadUrl(filePath)

    if (error || !data) {
      throw new Error(`Could not create upload URL: ${error?.message ?? 'unknown error'}`)
    }

    return {
      materialId,
      filePath,
      token: data.token,
      bucket: this.STORAGE_BUCKET,
    }
  }

  /**
   * Record a material for a file the browser has already put in storage. The row is
   * written only once the object is confirmed present, so a browser that dies
   * mid-upload leaves an orphaned object rather than a material that renders broken.
   */
  static async finalizeUpload(
    userId: string,
    materialId: string,
    fileName: string,
    metadata: MaterialMetadata
  ): Promise<StudyMaterial> {
    const db = getSupabaseAdmin()

    // materialId is client-supplied and gets interpolated into a storage path that
    // this method may remove() on failure. Anything but a plain UUID — `../` above
    // all — must never reach that path.
    if (!UUID_PATTERN.test(materialId)) {
      throw new MaterialValidationError('Invalid material id')
    }

    // Extension decides the storage path, so check it before building one.
    const nameCheck = validateMaterialUpload(fileName, 0)
    if (!nameCheck.valid) {
      throw new MaterialValidationError(nameCheck.error)
    }

    const fileExtension = fileName.split('.').pop()?.toLowerCase() as FileType

    // Re-derive the path rather than accept one from the client: a forged path would
    // point this user's row at somebody else's object.
    const filePath = `${userId}/${materialId}/original.${fileExtension}`

    // Size comes from storage, never from the client — a signed URL bounds only what
    // the client *said* it would send, not what it actually sent.
    const { data: info, error: infoError } = await db.storage
      .from(this.STORAGE_BUCKET)
      .info(filePath)

    if (infoError || !info) {
      throw new MaterialValidationError('Uploaded file not found in storage')
    }

    const fileSize = info.size ?? 0
    const sizeCheck = validateMaterialUpload(fileName, fileSize)
    if (!sizeCheck.valid) {
      await db.storage.from(this.STORAGE_BUCKET).remove([filePath])
      throw new MaterialValidationError(sizeCheck.error)
    }

    const materialData = {
      id: materialId,
      user_id: userId,
      title: metadata.title || fileName.replace(/\.[^/.]+$/, ''),
      file_name: fileName,
      file_type: fileExtension,
      file_size: fileSize,
      file_path: filePath,
      category: metadata.category || null,
      parsing_status: 'pending' as const,
    }

    const { error: dbError } = await db
      .from('study_materials')
      .insert(materialData)
      .select()
      .single()

    if (dbError) {
      await db.storage.from(this.STORAGE_BUCKET).remove([filePath])
      throw new Error(`Database error: ${dbError.message}`)
    }

    if (metadata.tags && metadata.tags.length > 0) {
      const tagData = metadata.tags.map((tag) => ({
        material_id: materialId,
        tag: tag.trim().toLowerCase(),
      }))
      await db.from('material_tags').insert(tagData)
    }

    return this.getMaterial(materialId)
  }
 
  /** Create a link-based material (YouTube / web URL) — no file upload. */
  static async createLinkMaterial(
    userId: string,
    sourceUrl: string,
    fileType: LinkType,
    metadata: MaterialMetadata
  ): Promise<StudyMaterial> {
    const db = getSupabaseAdmin()
    const materialId = crypto.randomUUID()

    const materialData = {
      id: materialId,
      user_id: userId,
      title: metadata.title?.trim() || sourceUrl,
      file_name: sourceUrl,
      file_type: fileType,
      file_size: 0,
      file_path: null,
      source_url: sourceUrl,
      category: metadata.category || null,
      parsing_status: 'pending' as const,
    }

    const { error: dbError } = await db
      .from('study_materials')
      .insert(materialData)
      .select()
      .single()

    if (dbError) {
      throw new Error(`Database error: ${dbError.message}`)
    }

    if (metadata.tags && metadata.tags.length > 0) {
      const tagData = metadata.tags.map((tag) => ({
        material_id: materialId,
        tag: tag.trim().toLowerCase(),
      }))
      await db.from('material_tags').insert(tagData)
    }

    return this.getMaterial(materialId)
  }

  static async getMaterial(materialId: string): Promise<StudyMaterial> {
    const db = getSupabaseAdmin()
    const { data: material, error } = await db
      .from('study_materials')
      .select('*')
      .eq('id', materialId)
      .single()
 
    if (error || !material) {
      throw new Error('Material not found')
    }
 
    const { data: tags } = await db
      .from('material_tags')
      .select('tag')
      .eq('material_id', materialId)
 
    return mapMaterial(material, tags?.map((t) => t.tag) || [])
  }
 
  /** Cheap ownership lookup — avoids fetching the full material just to authz. */
  static async getMaterialOwner(materialId: string): Promise<string | null> {
    const db = getSupabaseAdmin()
    const { data } = await db
      .from('study_materials')
      .select('user_id')
      .eq('id', materialId)
      .single()
    return data?.user_id ?? null
  }

  static async listMaterials(userId: string): Promise<StudyMaterial[]> {
    const db = getSupabaseAdmin()
    // List view never renders parsed_content (can be megabytes) — omit it.
    const { data: materials, error } = await db
      .from('study_materials')
      .select(
        'id, user_id, title, file_name, file_type, file_size, file_path, source_url, parsing_status, parsing_error, category, language, created_at, updated_at'
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
 
    if (error) {
      throw new Error(`Failed to list materials: ${error.message}`)
    }
 
    const materialIds = materials.map((m) => m.id)
    const { data: tags } = await db
      .from('material_tags')
      .select('material_id, tag')
      .in('material_id', materialIds)
 
    const tagsByMaterial = tags?.reduce(
      (acc, tag) => {
        if (!acc[tag.material_id]) acc[tag.material_id] = []
        acc[tag.material_id].push(tag.tag)
        return acc
      },
      {} as Record<string, string[]>
    )
 
    return materials.map((material) =>
      mapMaterial(material, tagsByMaterial?.[material.id] || [])
    )
  }
 
  static async updateMaterial(
    materialId: string,
    updates: Partial<StudyMaterial>
  ): Promise<StudyMaterial> {
    const db = getSupabaseAdmin()
    const updateData: { title?: string; category?: string | null } = {}
    if (updates.title) updateData.title = updates.title
    if (updates.category !== undefined) updateData.category = updates.category
 
    const { error } = await db
      .from('study_materials')
      .update(updateData)
      .eq('id', materialId)
 
    if (error) {
      throw new Error(`Update failed: ${error.message}`)
    }
 
    if (updates.tags !== undefined) {
      await db.from('material_tags').delete().eq('material_id', materialId)
 
      if (updates.tags.length > 0) {
        const tagData = updates.tags.map((tag) => ({
          material_id: materialId,
          tag: tag.trim().toLowerCase(),
        }))
        const { error: tagError } = await db.from('material_tags').insert(tagData)
        if (tagError) {
          throw new Error(`Failed to insert tags: ${tagError.message}`)
        }
      }
    }
 
    return this.getMaterial(materialId)
  }
 
  static async deleteMaterial(materialId: string): Promise<void> {
    const db = getSupabaseAdmin()
    const material = await this.getMaterial(materialId)

    // Link materials (youtube/url) have no stored file to remove.
    if (material.filePath) {
      const extractedPath = material.filePath.replace(/original\.\w+$/, 'extracted.txt')
      const { error: storageError } = await db.storage
        .from(this.STORAGE_BUCKET)
        .remove([material.filePath, extractedPath])

      // Stop before dropping the row. These errors used to be discarded, so a
      // failed removal left the file behind while its only reference vanished —
      // the bucket still holds one such orphan, and the privacy policy promises
      // the original goes with the material. Better to fail and be retried.
      if (storageError) {
        throw new Error(`Delete failed: could not remove stored files: ${storageError.message}`)
      }
    }

    const { error } = await db
      .from('study_materials')
      .delete()
      .eq('id', materialId)
 
    if (error) {
      throw new Error(`Delete failed: ${error.message}`)
    }
  }
 
  static async downloadMaterial(materialId: string): Promise<Blob> {
    const db = getSupabaseAdmin()
    const material = await this.getMaterial(materialId)

    if (!material.filePath) {
      throw new Error('Material has no stored file (link-based source)')
    }

    const { data, error } = await db.storage
      .from(this.STORAGE_BUCKET)
      .download(material.filePath)
 
    if (error || !data) {
      throw new Error(`Download failed: ${error?.message ?? 'unknown'}`)
    }
 
    return data
  }
}