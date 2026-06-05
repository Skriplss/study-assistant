import {
  addTag,
  getCategorySuggestions,
  getTagSuggestions,
  isDuplicateTag,
  normalizeTag,
  removeTag,
  validateTag,
} from '../tag-management'

describe('normalizeTag', () => {
  it('should trim and lowercase tags', () => {
    expect(normalizeTag('  Algebra  ')).toBe('algebra')
  })

  it('should replace spaces with hyphens', () => {
    expect(normalizeTag('Machine Learning')).toBe('machine-learning')
  })
})

describe('validateTag', () => {
  it('should reject empty tags', () => {
    expect(validateTag('   ').valid).toBe(false)
  })

  it('should accept valid tags', () => {
    expect(validateTag('python-101').valid).toBe(true)
  })
})

describe('tag uniqueness', () => {
  it('should detect duplicate tags case-insensitively', () => {
    expect(isDuplicateTag('Math', ['math'])).toBe(true)
    expect(isDuplicateTag('Physics', ['math'])).toBe(false)
  })

  it('should prevent adding duplicate tags', () => {
    const result = addTag('Math', ['algebra', 'math'])
    expect(result.tags).toEqual(['algebra', 'math'])
    expect(result.error).toBe('Tag already added')
  })

  it('should add a new normalized tag', () => {
    const result = addTag('  Data Science  ', [])
    expect(result.tags).toEqual(['data-science'])
    expect(result.error).toBeUndefined()
  })
})

describe('removeTag', () => {
  it('should remove tags regardless of casing', () => {
    expect(removeTag('MATH', ['math', 'physics'])).toEqual(['physics'])
  })
})

describe('getTagSuggestions', () => {
  const available = [
    { tag: 'math', count: 2 },
    { tag: 'mathematics', count: 1 },
    { tag: 'physics', count: 3 },
  ]

  it('should filter suggestions by query', () => {
    expect(getTagSuggestions('mat', available, [])).toEqual([
      'math',
      'mathematics',
    ])
  })

  it('should exclude already selected tags', () => {
    expect(getTagSuggestions('ma', available, ['math'])).toEqual(['mathematics'])
  })

  it('should respect the suggestion limit', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({
      tag: `topic-${i}`,
      count: 1,
    }))
    expect(getTagSuggestions('', many, [], 5)).toHaveLength(5)
  })
})

describe('getCategorySuggestions', () => {
  it('should filter categories by query', () => {
    expect(
      getCategorySuggestions('comp', [
        'Computer Science',
        'Mathematics',
        'Composition',
      ])
    ).toEqual(['Computer Science', 'Composition'])
  })

  it('should deduplicate categories case-insensitively', () => {
    expect(
      getCategorySuggestions('', ['Math', 'math', 'Physics'])
    ).toEqual(['Math', 'Physics'])
  })
})
