import { describe, expect, it } from 'vitest'
import { readPublicEnv } from './readPublicEnv'

describe('readPublicEnv', () => {
  it('prefers non-empty process.env over empty', () => {
    const key = 'YAADEIN_ENTRA_CLIENT_ID'
    const previous = process.env[key]
    process.env[key] = 'runtime-client'
    try {
      expect(readPublicEnv(key)).toBe('runtime-client')
    } finally {
      if (previous === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = previous
      }
    }
  })
})
