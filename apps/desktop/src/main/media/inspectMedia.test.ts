import { createHash } from 'node:crypto'
import { mkdtemp, writeFile, utimes } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { hashFileContent } from './hashFile'
import { mapParsedExif } from './extractExif'
import { mediaTypeFromPath } from './mediaType'
import { inspectMediaFile } from './inspectMedia'

/** Minimal valid 1x1 JPEG (no EXIF). */
const TINY_JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGfAP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAQUCf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQMBAT8Bf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQIBAT8Bf//Z',
  'base64',
)

describe('mediaTypeFromPath', () => {
  it('maps common extensions', () => {
    expect(mediaTypeFromPath('/a/b/photo.JPG')).toBe('image/jpeg')
    expect(mediaTypeFromPath('/a/b/clip.mp4')).toBe('video/mp4')
    expect(mediaTypeFromPath('/a/b/unknown.bin')).toBe('application/octet-stream')
  })
})

describe('hashFileContent', () => {
  it('returns stable SHA-256 and size for a known fixture', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'yaadein-hash-'))
    const filePath = join(dir, 'tiny.jpg')
    await writeFile(filePath, TINY_JPEG)

    const expectedHash = createHash('sha256').update(TINY_JPEG).digest('hex')
    const result = await hashFileContent(filePath)

    expect(result.fileSize).toBe(TINY_JPEG.byteLength)
    expect(result.contentHash).toBe(expectedHash)
  })
})

describe('mapParsedExif', () => {
  it('maps capture date, dimensions, and tags from parsed fields', () => {
    const mapped = mapParsedExif({
      DateTimeOriginal: new Date('2020-07-18T15:30:00.000Z'),
      ExifImageWidth: 4032,
      ExifImageHeight: 3024,
      PersonInImage: ['Aaryan'],
      City: 'Yellowstone',
      Event: 'Summer Vacation',
      latitude: 44.428,
      longitude: -110.5885,
    })

    expect(mapped.captureDate?.toISOString()).toBe('2020-07-18T15:30:00.000Z')
    expect(mapped.width).toBe(4032)
    expect(mapped.height).toBe(3024)
    expect(mapped.tags.people).toContain('Aaryan')
    expect(mapped.tags.places).toContain('Yellowstone')
    expect(mapped.tags.places.some((place) => place.startsWith('44.428'))).toBe(true)
    expect(mapped.tags.events).toContain('Summer Vacation')
  })

  it('returns empty defaults when parsing yields nothing', () => {
    const mapped = mapParsedExif(undefined)
    expect(mapped.captureDate).toBeNull()
    expect(mapped.tags).toEqual({ people: [], places: [], events: [] })
  })
})

describe('inspectMediaFile', () => {
  it('hashes a file and falls back organize date to filesystem when EXIF is absent', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'yaadein-inspect-'))
    const filePath = join(dir, 'plain.jpg')
    await writeFile(filePath, TINY_JPEG)
    const stamp = new Date('2022-02-03T08:00:00.000Z')
    await utimes(filePath, stamp, stamp)

    const inspection = await inspectMediaFile(filePath)
    expect(inspection.mediaType).toBe('image/jpeg')
    expect(inspection.fileSize).toBe(TINY_JPEG.byteLength)
    expect(inspection.contentHash).toHaveLength(64)
    expect(inspection.organizeDateSource).toBe('filesystem')
    expect(inspection.organizeDate.startsWith('2022-02-03')).toBe(true)
    expect(inspection.tags).toEqual({ people: [], places: [], events: [] })
  })

  it('honors user organize-date override', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'yaadein-inspect-'))
    const filePath = join(dir, 'plain.jpg')
    await writeFile(filePath, TINY_JPEG)

    const inspection = await inspectMediaFile(filePath, {
      userOverrideDate: new Date('2018-11-20T12:00:00.000Z'),
    })
    expect(inspection.organizeDateSource).toBe('user_override')
    expect(inspection.organizeDate).toBe('2018-11-20T12:00:00.000Z')
  })
})
