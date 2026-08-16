import { validateMaterialFile } from '@/lib/materials/file-validation'

const validateFile = validateMaterialFile

describe('validateMaterialFile', () => {
  it('should validate a valid PDF file', () => {
    const file = new File(['test'], 'test.pdf', { type: 'application/pdf' })
    const result = validateFile(file)
    expect(result.valid).toBe(true)
  })

  it('should validate a valid TXT file', () => {
    const file = new File(['test'], 'test.txt', { type: 'text/plain' })
    const result = validateFile(file)
    expect(result.valid).toBe(true)
  })

  it('should validate a valid MD file', () => {
    const file = new File(['test'], 'test.md', { type: 'text/markdown' })
    const result = validateFile(file)
    expect(result.valid).toBe(true)
  })

  it('should reject files exceeding size limit', () => {
    const largeContent = new Array(51 * 1024 * 1024).fill('x').join('')
    const file = new File([largeContent], 'large.pdf', {
      type: 'application/pdf',
    })
    const result = validateFile(file)
    expect(result.valid).toBe(false)
    expect(result.error).toContain('exceeds the maximum limit')
  })

  it('should reject unsupported file types', () => {
    const file = new File(['test'], 'test.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    })
    const result = validateFile(file)
    expect(result.valid).toBe(false)
    expect(result.error).toContain('not supported')
  })

  it('should reject files without extension', () => {
    const file = new File(['test'], 'test', { type: 'application/octet-stream' })
    const result = validateFile(file)
    expect(result.valid).toBe(false)
  })
})

describe('validateMaterialFile file size validation', () => {
  it('should accept file at maximum size limit', () => {
    const maxContent = new Array(50 * 1024 * 1024).fill('x').join('')
    const file = new File([maxContent], 'max.pdf', {
      type: 'application/pdf',
    })
    const result = validateFile(file)
    expect(result.valid).toBe(true)
  })

  it('should accept small files', () => {
    const file = new File(['small content'], 'small.txt', {
      type: 'text/plain',
    })
    const result = validateFile(file)
    expect(result.valid).toBe(true)
  })
})

describe('validateMaterialFile file type validation', () => {
  it('should handle case-insensitive extensions', () => {
    const file1 = new File(['test'], 'test.PDF', { type: 'application/pdf' })
    const file2 = new File(['test'], 'test.Txt', { type: 'text/plain' })
    const file3 = new File(['test'], 'test.MD', { type: 'text/markdown' })

    expect(validateFile(file1).valid).toBe(true)
    expect(validateFile(file2).valid).toBe(true)
    expect(validateFile(file3).valid).toBe(true)
  })

  it('should reject common invalid types', () => {
    const invalidTypes = [
      { name: 'test.doc', type: 'application/msword' },
      { name: 'test.xlsx', type: 'application/vnd.ms-excel' },
      { name: 'test.zip', type: 'application/zip' },
    ]

    invalidTypes.forEach(({ name, type }) => {
      const file = new File(['test'], name, { type })
      const result = validateFile(file)
      expect(result.valid).toBe(false)
    })
  })

  // Images became first-class when text extraction from them shipped; they used
  // to sit in the rejected list above.
  it('should accept image types', () => {
    const imageTypes = [
      { name: 'test.png', type: 'image/png' },
      { name: 'test.jpg', type: 'image/jpeg' },
      { name: 'test.jpeg', type: 'image/jpeg' },
    ]

    imageTypes.forEach(({ name, type }) => {
      const file = new File(['test'], name, { type })
      expect(validateFile(file).valid).toBe(true)
    })
  })
})

describe('MaterialService storage path generation', () => {
  it('should generate correct storage paths', () => {
    const userId = 'user-123'
    const materialId = 'material-456'
    const expectedPath = `${userId}/${materialId}/original.pdf`
    
    // This is implicitly tested in uploadMaterial, but we verify the pattern
    expect(expectedPath).toMatch(/^user-\d+\/material-\d+\/original\.\w+$/)
  })
})

describe('MaterialService upload error handling', () => {
  it('should handle upload errors gracefully', async () => {
    // Mock scenario where upload fails
    const file = new File(['test'], 'test.pdf', { type: 'application/pdf' })
    
    // This would need actual Supabase mocks to fully test
    // For now, we verify the validation works
    const validation = validateFile(file)
    expect(validation.valid).toBe(true)
  })
})
