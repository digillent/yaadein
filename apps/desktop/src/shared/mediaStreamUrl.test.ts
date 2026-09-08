import { describe, expect, it } from 'vitest'
import { absolutePathFromMediaStreamUrl, buildMediaStreamUrl } from './mediaStreamUrl'

describe('mediaStreamUrl', () => {
  it('round-trips absolute paths including spaces', () => {
    const path = '/Users/me/My Photos/clip.mp4'
    const href = buildMediaStreamUrl(path)
    expect(href.startsWith('yaadein-media:')).toBe(true)
    expect(absolutePathFromMediaStreamUrl(href)).toBe(path)
  })

  it('returns null for non-scheme urls', () => {
    expect(absolutePathFromMediaStreamUrl('https://example.com/x')).toBeNull()
  })
})
