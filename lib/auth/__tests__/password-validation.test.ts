import { validatePassword, getPasswordStrength } from '../password-validation'

describe('validatePassword', () => {
  it('should validate a strong password', () => {
    const result = validatePassword('MyPassword123')
    expect(result.isValid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('should reject password shorter than 8 characters', () => {
    const result = validatePassword('Pass1')
    expect(result.isValid).toBe(false)
    expect(result.errors).toContain(
      'Password must be at least 8 characters long'
    )
  })

  it('should reject password without lowercase letter', () => {
    const result = validatePassword('PASSWORD123')
    expect(result.isValid).toBe(false)
    expect(result.errors).toContain(
      'Password must contain at least one lowercase letter'
    )
  })

  it('should reject password without uppercase letter', () => {
    const result = validatePassword('password123')
    expect(result.isValid).toBe(false)
    expect(result.errors).toContain(
      'Password must contain at least one uppercase letter'
    )
  })

  it('should reject password without number', () => {
    const result = validatePassword('Password')
    expect(result.isValid).toBe(false)
    expect(result.errors).toContain('Password must contain at least one number')
  })

  it('should return multiple errors for invalid password', () => {
    const result = validatePassword('pass')
    expect(result.isValid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(1)
  })
})

describe('getPasswordStrength', () => {
  it('should return weak for simple passwords', () => {
    expect(getPasswordStrength('pass123')).toBe('weak')
    expect(getPasswordStrength('password')).toBe('weak')
  })

  it('should return medium for moderately complex passwords', () => {
    expect(getPasswordStrength('Password1')).toBe('medium')
    expect(getPasswordStrength('MyPass123')).toBe('medium')
  })

  it('should return strong for complex passwords', () => {
    expect(getPasswordStrength('MyP@ssw0rd123')).toBe('strong')
    expect(getPasswordStrength('C0mpl3x!Pass')).toBe('strong')
  })
})
