import { describe, expect, it } from 'vitest'
import { duplicateActionFromKey } from './duplicateKeys'

describe('duplicateActionFromKey', () => {
  it('maps navigation and delete', () => {
    expect(duplicateActionFromKey('ArrowLeft')).toBe('prev')
    expect(duplicateActionFromKey('ArrowRight')).toBe('next')
    expect(duplicateActionFromKey('ArrowDown')).toBe('delete')
    expect(duplicateActionFromKey('ArrowUp')).toBeNull()
  })
})
