import 'server-only'
 
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { validateMaterialFile } from '@/lib/materials/file-validation'
import type { StudyMaterial, MaterialMetadata } from '@/lib/types'
 
type FileType = StudyMaterial['fileType']
type LinkType = 'youtube' | 'url'
type ParsingStatus = 'pending' | 'processing' | 'completed' | 'failed'
 
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
 
  static async uploadMaterial(
    userId: string,
    file: File,
    metadata: MaterialMetadata,
    onProgress?: (progress: number) => void
  ): Promise<StudyMaterial> {
    console.log('[MaterialService] Starting upload:', {
      userId,
      fileName: file.name,
      fileSize: file.size,
      metadata,
    })

    const validation = this.validateFile(file)
    if (!validation.valid) {
      console.log('[MaterialService] Validation failed:', validation.error)
      throw new Error(validation.error)
    }
 
    const db = getSupabaseAdmin()
    const fileExtension = file.name.split('.').pop()?.toLowerCase() as FileType
    const materialId = crypto.randomUUID()
    const filePath = `${userId}/${materialId}/original.${fileExtension}`
 
    console.log('[MaterialService] Generated filePath:', filePath)

    try {
      if (onProgress) onProgress(10)

      // Check if bucket exists and is accessible
      console.log('[MaterialService] Checking storage bucket...')
      const { data: buckets, error: bucketsError } = await db.storage.listBuckets()
      if (bucketsError) {
        console.error('[MaterialService] Bucket list error:', bucketsError)
        throw new Error(`Storage not accessible: ${bucketsError.message}. Please check Supabase Storage configuration.`)
      }
      
      const bucketExists = buckets?.some(b => b.name === this.STORAGE_BUCKET)
      console.log('[MaterialService] Bucket exists:', bucketExists, 'Available buckets:', buckets?.map(b => b.name))
      
      if (!bucketExists) {
        throw new Error(`Storage bucket "${this.STORAGE_BUCKET}" does not exist. Please create it in Supabase Dashboard under Storage.`)
      }
 
      console.log('[MaterialService] Uploading file to storage...')
      const { error: uploadError } = await db.storage
        .from(this.STORAGE_BUCKET)
        .upload(filePath, file, { cacheControl: '3600', upsert: false })
 
      if (uploadError) {
        console.error('[MaterialService] Storage upload error:', uploadError)
        throw new Error(`Upload failed: ${uploadError.message}`)
      }
 
      console.log('[MaterialService] File uploaded successfully')
      if (onProgress) onProgress(50)
 
      const materialData = {
        id: materialId,
        user_id: userId,
        title: metadata.title || file.name.replace(/\.[^/.]+$/, ''),
        file_name: file.name,
        file_type: fileExtension,
        file_size: file.size,
        file_path: filePath,
        category: metadata.category || null,
        parsing_status: 'pending' as const,
      }
 
      console.log('[MaterialService] Inserting material to database:', materialData)
      const { error: dbError } = await db
        .from('study_materials')
        .insert(materialData)
        .select()
        .single()
 
      if (dbError) {
        console.error('[MaterialService] DB Error:', JSON.stringify(dbError, null, 2))
        console.log('[MaterialService] Cleaning up uploaded file...')
        await db.storage.from(this.STORAGE_BUCKET).remove([filePath])
        throw new Error(`Database error: ${dbError.message}`)
      }
 
      console.log('[MaterialService] Material record created successfully')
      if (onProgress) onProgress(75)
 
      if (metadata.tags && metadata.tags.length > 0) {
        console.log('[MaterialService] Adding tags:', metadata.tags)
        const tagData = metadata.tags.map((tag) => ({
          material_id: materialId,
          tag: tag.trim().toLowerCase(),
        }))
        await db.from('material_tags').insert(tagData)
        console.log('[MaterialService] Tags added successfully')
      }
 
      if (onProgress) onProgress(100)
 
      console.log('[MaterialService] Fetching created material...')
      return this.getMaterial(materialId)
    } catch (error) {
      console.error('[MaterialService] Error in uploadMaterial:', error)
      // Clean up on error
      try {
        console.log('[MaterialService] Attempting cleanup...')
        await db.storage.from(this.STORAGE_BUCKET).remove([filePath])
        console.log('[MaterialService] Cleanup successful')
      } catch (cleanupError) {
        console.error('[MaterialService] Cleanup failed:', cleanupError)
      }
      throw error
    }
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
      await db.storage.from(this.STORAGE_BUCKET).remove([material.filePath])
      const extractedPath = material.filePath.replace(/original\.\w+$/, 'extracted.txt')
      await db.storage.from(this.STORAGE_BUCKET).remove([extractedPath])
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