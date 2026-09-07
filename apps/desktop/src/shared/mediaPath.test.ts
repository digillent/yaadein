import { describe, expect, it } from 'vitest'
import { isMediaPath, mediaTypeFromPath } from './mediaPath'

describe('mediaPath', () => {
  it('accepts previewable image and video extensions', () => {
    expect(isMediaPath('/a/photo.JPG')).toBe(true)
    expect(isMediaPath('/a/clip.mov')).toBe(true)
    expect(mediaTypeFromPath('/a/photo.jpg')).toBe('image/jpeg')
  })

  it('rejects non-media like .DS_Store and text', () => {
    expect(isMediaPath('/a/.DS_Store')).toBe(false)
    expect(isMediaPath('/a/notes.txt')).toBe(false)
    expect(isMediaPath('/a/Thumbs.db')).toBe(false)
  })
})
