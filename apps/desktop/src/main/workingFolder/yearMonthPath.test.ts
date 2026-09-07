import { describe, expect, it } from 'vitest'
import { yearMonthFromCleanupRelativePath } from './yearMonthPath'

describe('yearMonthFromCleanupRelativePath', () => {
  it('parses YYYY/MM prefix', () => {
    expect(yearMonthFromCleanupRelativePath('2026/01/photo.jpg')).toBe('2026/01')
    expect(yearMonthFromCleanupRelativePath('2025/12/a/b.jpg')).toBe('2025/12')
  })

  it('returns null when missing', () => {
    expect(yearMonthFromCleanupRelativePath('photo.jpg')).toBeNull()
    expect(yearMonthFromCleanupRelativePath('2026/photo.jpg')).toBeNull()
  })
})
