import { describe, expect, it } from 'vitest'
import { buildLocalMediaPreview } from './buildLocalMediaPreview'

describe('buildLocalMediaPreview', () => {
  it('builds stream-only image preview', () => {
    const preview = buildLocalMediaPreview('/tmp/a.jpg')
    expect(preview.kind).toBe('image')
    expect(preview.dataUrl).toBeNull()
    expect(preview.streamUrl).toContain('yaadein-media:')
    expect(new URL(preview.streamUrl!).searchParams.get('path')).toBe('/tmp/a.jpg')
  })

  it('builds stream-only video preview', () => {
    const preview = buildLocalMediaPreview('/tmp/clip.mp4')
    expect(preview.kind).toBe('video')
    expect(preview.mediaType).toBe('video/mp4')
    expect(preview.dataUrl).toBeNull()
  })

  it('marks unsupported extensions', () => {
    expect(buildLocalMediaPreview('/tmp/.DS_Store').kind).toBe('unsupported')
  })
})
