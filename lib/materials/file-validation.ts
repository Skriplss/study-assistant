const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB
const ALLOWED_TYPES = ['pdf', 'txt', 'md', 'pptx', 'png', 'jpg', 'jpeg']

export function validateMaterialFile(file: File): {
  valid: boolean
  error?: string
} {
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size exceeds the maximum limit of ${MAX_FILE_SIZE / 1024 / 1024}MB`,
    }
  }

  const extension = file.name.split('.').pop()?.toLowerCase()
  if (!extension || !ALLOWED_TYPES.includes(extension)) {
    return {
      valid: false,
      error: `File type .${extension} is not supported. Allowed types: ${ALLOWED_TYPES.join(', ')}`,
    }
  }

  return { valid: true }
}
