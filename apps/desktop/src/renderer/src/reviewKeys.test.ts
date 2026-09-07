import { describe, expect, it } from 'vitest'
import { reviewActionFromKey } from './reviewKeys'

describe('reviewActionFromKey', () => {
  it('maps arrow keys to review actions', () => {
    expect(reviewActionFromKey('ArrowLeft')).toBe('prev')
    expect(reviewActionFromKey('ArrowRight')).toBe('next')
    expect(reviewActionFromKey('ArrowUp')).toBe('accept')
    expect(reviewActionFromKey('ArrowDown')).toBe('reject')
  })

  it('ignores unrelated keys', () => {
    expect(reviewActionFromKey('Enter')).toBeNull()
    expect(reviewActionFromKey('a')).toBeNull()
  })
})
