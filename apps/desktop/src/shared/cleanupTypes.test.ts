import { describe, expect, it } from 'vitest'
import { cleanupDeleteSkipsConfirm } from './cleanupTypes'

describe('cleanupDeleteSkipsConfirm', () => {
  it('skips only when the flag is exactly true', () => {
    expect(cleanupDeleteSkipsConfirm(true)).toBe(true)
    expect(cleanupDeleteSkipsConfirm(false)).toBe(false)
    expect(cleanupDeleteSkipsConfirm(undefined)).toBe(false)
    expect(cleanupDeleteSkipsConfirm('true')).toBe(false)
  })
})
