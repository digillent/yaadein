import { describe, expect, it } from 'vitest'
import { appName, getShellTitle } from './appInfo'

describe('appInfo', () => {
  it('exposes the Yaadein product name', () => {
    expect(appName).toBe('Yaadein')
  })

  it('returns a shell window title', () => {
    expect(getShellTitle()).toBe('Yaadein')
  })
})
