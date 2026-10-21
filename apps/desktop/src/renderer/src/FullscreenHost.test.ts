import { describe, expect, it } from 'vitest'
import { fullscreenControlLabel } from './FullscreenHost'

describe('fullscreenControlLabel', () => {
  it('switches between enter and exit', () => {
    expect(fullscreenControlLabel(false)).toBe('Full screen')
    expect(fullscreenControlLabel(true)).toBe('Exit full screen')
  })
})
