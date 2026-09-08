import { afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { buildMediaPreview } from './previewMedia'

describe('buildMediaPreview', () => {
  const dirs: string[] = []

  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('marks images with stream url and kind image without base64', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'yaadein-preview-'))
    dirs.push(dir)
    const file = join(dir, 'a.jpg')
    writeFileSync(file, Buffer.from([0xff, 0xd8, 0xff, 0xd9]))

    const preview = await buildMediaPreview(file)
    expect(preview.kind).toBe('image')
    expect(preview.streamUrl).toContain('yaadein-media:')
    expect(preview.dataUrl).toBeNull()
    expect(new URL(preview.streamUrl!).searchParams.get('path')).toBe(file)
  })

  it('marks videos with stream url and kind video', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'yaadein-preview-'))
    dirs.push(dir)
    const file = join(dir, 'clip.mp4')
    writeFileSync(file, Buffer.from('fake'))

    const preview = await buildMediaPreview(file)
    expect(preview.kind).toBe('video')
    expect(preview.mediaType).toBe('video/mp4')
    expect(preview.streamUrl).toContain('yaadein-media:')
    expect(preview.dataUrl).toBeNull()
  })
})
