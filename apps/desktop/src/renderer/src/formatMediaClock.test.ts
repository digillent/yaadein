import { describe, expect, it } from 'vitest'
import { formatMediaClock } from './formatMediaClock'

describe('formatMediaClock', () => {
  it('formats minutes and hours', () => {
    expect(formatMediaClock(0)).toBe('0:00')
    expect(formatMediaClock(65)).toBe('1:05')
    expect(formatMediaClock(3661)).toBe('1:01:01')
  })

  it('treats non-finite values as zero', () => {
    expect(formatMediaClock(Number.NaN)).toBe('0:00')
    expect(formatMediaClock(Number.POSITIVE_INFINITY)).toBe('0:00')
  })
})
