import { supabase } from '@/lib/supabase/client'
import { supabaseAdmin } from '@/lib/supabase/server'
import type { StudyMaterial, MaterialMetadata } from '@/lib/types'

export class MaterialService {
  private static readonly MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB
  private static readonly ALLOWED_TYPES = ['pdf', 'txt', 'md']
  private static readonly STORAGE_BUCKET = 'materials'

  /**
   * Validate file before upload
   */
  static validateFile(file: File): { valid: boolean; error?: string } {
    // Check file size
    if (file.size > this.MAX_FILE_SIZE) {
      return {
        valid: false,
        error: `File size exceeds the maximum limit of ${this.MAX_FILE_SIZE / 1024 / 1024}MB`,
      }
    }

    // Check file type
    const extension = file.name.split('.').pop()?.toLowerCase()
    if (!extension || !this.ALLOWED_TYPES.includes(extension)) {
      return {
        valid: false,
        error: `File type .${extension} is not supported. Allowed types: ${this.ALLOWED_TYPES.join(', ')}`,
      }
    }

    return { valid: true }
  }

  /**
   * Upload material to Supabase Storage
   */
  static async uploadMaterial(
    userId: string,
    file: File,
    metadata: MaterialMetadata,
    onProgress?: (progress: number) => void
  ): Promise<StudyMaterial> {
    // Validate file
    const validation = this.validateFile(file)
    if (!validation.valid) {
      throw new Error(validation.error)
    }

    const fileExtension = file.name.split('.').pop()?.toLowerCase() as
      | 'pdf'
      | 'txt'
      | 'md'
    const materialId = crypto.randomUUID()
    const filePath = `${userId}/${materialId}/original.${fileExtension}`

    try {
      // Upload file to storage
      if (onProgress) onProgress(10)
      
        const storageClient = typeof window === 'undefined' ? supabaseAdmin : supabase
        const { error: uploadError } = await storageClient.storage
        .from(this.STORAGE_BUCKET)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        })

      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`)
      }

      if (onProgress) onProgress(50)

      // Create database record
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

        const dbClient = typeof window === 'undefined' ? supabaseAdmin : supabase
        const { data: material, error: dbError } = await dbClient
        .from('study_materials')
        .insert(materialData)
        .select()
        .single()

      if (dbError) {
        // Rollback: delete uploaded file
          await storageClient.storage.from(this.STORAGE_BUCKET).remove([filePath])
        throw new Error(`Database error: ${dbError.message}`)
      }

      if (onProgress) onProgress(75)

      // Add tags if provided
      if (metadata.tags && metadata.tags.length > 0) {
        const tagData = metadata.tags.map((tag) => ({
          material_id: materialId,
          tag: tag.trim().toLowerCase(),
        }))

          await dbClient.from('material_tags').insert(tagData)
      }

      if (onProgress) onProgress(100)

      // Fetch complete material with tags
      const completeMaterial = await this.getMaterial(materialId)
      return completeMaterial
    } catch (error) {
      // Cleanup on error
        await storageClient.storage.from(this.STORAGE_BUCKET).remove([filePath])
      throw error
    }
  }

  /**
   * Get material by ID
   */
  static async getMaterial(materialId: string): Promise<StudyMaterial> {
    const dbClient = typeof window === 'undefined' ? supabaseAdmin : supabase
    const { data: material, error } = await dbClient
      .from('study_materials')
      .select('*')
      .eq('id', materialId)
      .single()

    if (error || !material) {
      throw new Error('Material not found')
    }

    // Get tags
    const { data: tags } = await dbClient
      .from('material_tags')
      .select('tag')
      .eq('material_id', materialId)

    return {
      id: material.id,
      userId: material.user_id,
      title: material.title,
      fileName: material.file_name,
      fileType: material.file_type,
      fileSize: material.file_size,
      filePath: material.file_path,
      parsedContent: material.parsed_content,
      parsingStatus: material.parsing_status,
      parsingError: material.parsing_error,
      category: material.category,
      tags: tags?.map((t) => t.tag) || [],
      createdAt: material.created_at,
      updatedAt: material.updated_at,
    }
  }

  /**
   * List materials for a user
   */
  static async listMaterials(userId: string): Promise<StudyMaterial[]> {
    const dbClient = typeof window === 'undefined' ? supabaseAdmin : supabase
    const { data: materials, error } = await dbClient
      .from('study_materials')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(`Failed to list materials: ${error.message}`)
    }

    // Get tags for all materials
    const materialIds = materials.map((m) => m.id)
    const { data: tags } = await dbClient
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

    return materials.map((material) => ({
      id: material.id,
      userId: material.user_id,
      title: material.title,
      fileName: material.file_name,
      fileType: material.file_type,
      fileSize: material.file_size,
      filePath: material.file_path,
      parsedContent: material.parsed_content,
      parsingStatus: material.parsing_status,
      parsingError: material.parsing_error,
      category: material.category,
      tags: tagsByMaterial?.[material.id] || [],
      createdAt: material.created_at,
      updatedAt: material.updated_at,
    }))
  }

  /**
   * Update material metadata
   */
  static async updateMaterial(
    materialId: string,
    updates: Partial<StudyMaterial>
  ): Promise<StudyMaterial> {
    const updateData: any = {}
    if (updates.title) updateData.title = updates.title
    if (updates.category !== undefined) updateData.category = updates.category

      const dbClient = typeof window === 'undefined' ? supabaseAdmin : supabase
      const { error } = await dbClient
      .from('study_materials')
      .update(updateData)
      .eq('id', materialId)

    if (error) {
      throw new Error(`Update failed: ${error.message}`)
    }

    // Update tags if provided
    if (updates.tags) {
      // Delete existing tags
        await dbClient.from('material_tags').delete().eq('material_id', materialId)

      // Insert new tags
      if (updates.tags.length > 0) {
        const tagData = updates.tags.map((tag) => ({
          material_id: materialId,
          tag: tag.trim().toLowerCase(),
        }))
          await dbClient.from('material_tags').insert(tagData)
      }
    }

    return this.getMaterial(materialId)
  }

  /**
   * Delete material (cascade delete)
   */
  static async deleteMaterial(materialId: string): Promise<void> {
    // Get material to find file path
    const material = await this.getMaterial(materialId)

    // Delete file from storage
      const storageClient = typeof window === 'undefined' ? supabaseAdmin : supabase
      await storageClient.storage
      .from(this.STORAGE_BUCKET)
      .remove([material.filePath])

    // Delete extracted text file if exists
    const extractedPath = material.filePath.replace(
      /original\.\w+$/,
      'extracted.txt'
    )
      await storageClient.storage.from(this.STORAGE_BUCKET).remove([extractedPath])

    // Delete database record (cascade will handle tags, quizzes, etc.)
      const dbClient = typeof window === 'undefined' ? supabaseAdmin : supabase
      const { error } = await dbClient
      .from('study_materials')
      .delete()
      .eq('id', materialId)

    if (error) {
      throw new Error(`Delete failed: ${error.message}`)
    }
  }

  /**
   * Download material file
   */
  static async downloadMaterial(materialId: string): Promise<Blob> {
    const material = await this.getMaterial(materialId)

      const storageClient = typeof window === 'undefined' ? supabaseAdmin : supabase
      const { data, error } = await storageClient.storage
      .from(this.STORAGE_BUCKET)
      .download(material.filePath)

    if (error || !data) {
      throw new Error('Download failed')
    }

    return data
  }
}
