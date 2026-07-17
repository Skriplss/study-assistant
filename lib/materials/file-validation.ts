// 50MB is the Supabase project's global per-file storage limit (the bucket sets no
// limit of its own), so raising this alone won't lift the ceiling.
export const MAX_FILE_SIZE = 50 * 1024 * 1024
export const ALLOWED_TYPES = ['pdf', 'txt', 'md', 'pptx', 'png', 'jpg', 'jpeg']

/**
 * Validate an upload from metadata alone. Uploads go straight from the browser to
 * Supabase Storage, so the server issuing the signed URL sees a name and a size —
 * never a File.
 */
export function validateMaterialUpload(
  fileName: string,
  fileSize: number
): { valid: boolean; error?: string } {
  if (fileSize > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size exceeds the maximum limit of ${MAX_FILE_SIZE / 1024 / 1024}MB`,
    }
  }

  const extension = fileName.split('.').pop()?.toLowerCase()
  if (!extension || !ALLOWED_TYPES.includes(extension)) {
    return {
      valid: false,
      error: `File type .${extension} is not supported. Allowed types: ${ALLOWED_TYPES.join(', ')}`,
    }
  }

  return { valid: true }
}

export function validateMaterialFile(file: File): {
  valid: boolean
  error?: string
} {
  return validateMaterialUpload(file.name, file.size)
}
