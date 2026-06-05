import 'server-only'
 
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { validateMaterialFile } from '@/lib/materials/file-validation'
import type { StudyMaterial, MaterialMetadata } from '@/lib/types'
 
type FileType = 'pdf' | 'txt' | 'md'
type ParsingStatus = 'pending' | 'processing' | 'completed' | 'failed'
 
function mapMaterial(material: any, tags: string[]): StudyMaterial {
  return {
    id: material.id,
    userId: material.user_id,
    title: material.title,
    fileName: material.file_name,
    fileType: material.file_type as FileType,
    fileSize: material.file_size,
    filePath: material.file_path,
    parsedContent: material.parsed_content,
    parsingStatus: (material.parsing_status ?? 'pending') as ParsingStatus,
    parsingError: material.parsing_error,
    category: material.category,
    tags,
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
    const validation = this.validateFile(file)
    if (!validation.valid) {
      throw new Error(validation.error)
    }
 
    const db = getSupabaseAdmin()
    const fileExtension = file.name.split('.').pop()?.toLowerCase() as FileType
    const materialId = crypto.randomUUID()
    const filePath = `${userId}/${materialId}/original.${fileExtension}`
 
    try {
      if (onProgress) onProgress(10)
 
      const { error: uploadError } = await db.storage
        .from(this.STORAGE_BUCKET)
        .upload(filePath, file, { cacheControl: '3600', upsert: false })
 
      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`)
      }
 
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
 
      const { error: dbError } = await db
        .from('study_materials')
        .insert(materialData)
        .select()
        .single()
 
      if (dbError) {
        console.error('DB Error:', JSON.stringify(dbError, null, 2))
        await db.storage.from(this.STORAGE_BUCKET).remove([filePath])
        throw new Error(`Database error: ${dbError.message}`)
      }
 
      if (onProgress) onProgress(75)
 
      if (metadata.tags && metadata.tags.length > 0) {
        const tagData = metadata.tags.map((tag) => ({
          material_id: materialId,
          tag: tag.trim().toLowerCase(),
        }))
        await db.from('material_tags').insert(tagData)
      }
 
      if (onProgress) onProgress(100)
 
      return this.getMaterial(materialId)
    } catch (error) {
      await db.storage.from(this.STORAGE_BUCKET).remove([filePath])
      throw error
    }
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
 
  static async listMaterials(userId: string): Promise<StudyMaterial[]> {
    const db = getSupabaseAdmin()
    const { data: materials, error } = await db
      .from('study_materials')
      .select('*')
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
 
    await db.storage.from(this.STORAGE_BUCKET).remove([material.filePath])
 
    const extractedPath = material.filePath.replace(/original\.\w+$/, 'extracted.txt')
    await db.storage.from(this.STORAGE_BUCKET).remove([extractedPath])
 
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
 
    const { data, error } = await db.storage
      .from(this.STORAGE_BUCKET)
      .download(material.filePath)
 
    if (error || !data) {
      throw new Error(`Download failed: ${error?.message ?? 'unknown'}`)
    }
 
    return data
  }
}