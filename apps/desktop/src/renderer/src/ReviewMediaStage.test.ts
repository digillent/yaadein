import { describe, expect, it } from 'vitest'
import { nextZoom } from './ReviewMediaStage'

describe('nextZoom', () => {
  it('zooms in and out within bounds', () => {
    expect(nextZoom(1, 'in')).toBeGreaterThan(1)
    expect(nextZoom(1, 'out')).toBe(1)
    expect(nextZoom(6, 'in')).toBe(6)
    expect(nextZoom(2, 'out')).toBeLessThan(2)
  })
})
