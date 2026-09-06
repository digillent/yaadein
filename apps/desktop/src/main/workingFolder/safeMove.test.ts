import { mkdtemp, mkdir, readFile, writeFile, access } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { ensureWorkingFolder } from './ensureTree'
import { moveMediaIntoWorkingFolder } from './safeMove'
import { WORKING_BUCKETS } from './types'

async function exists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

describe('workingFolder ensure + move', () => {
  const temps: string[] = []

  afterEach(async () => {
    // Best-effort cleanup is unnecessary for CI tmp; keep tests isolated by unique dirs.
    temps.length = 0
  })

  async function makeTemp(prefix: string): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), prefix))
    temps.push(dir)
    return dir
  }

  it('creates preserve, duplicate, and rejected under the working root', async () => {
    const root = await makeTemp('yaadein-root-')
    await ensureWorkingFolder(root)

    for (const bucket of WORKING_BUCKETS) {
      expect(await exists(join(root, bucket))).toBe(true)
    }
  })

  it('moves a file into preserve/YYYY/MM on the same volume', async () => {
    const root = await makeTemp('yaadein-work-')
    const sourceDir = await makeTemp('yaadein-src-')
    const sourcePath = join(sourceDir, 'photo.jpg')
    await writeFile(sourcePath, 'hello-photo')

    const result = await moveMediaIntoWorkingFolder({
      sourcePath,
      workingRoot: root,
      bucket: 'preserve',
      captureDate: new Date('2026-09-05T15:00:00.000Z'),
    })

    expect(result.yearMonth).toBe('2026/09')
    expect(result.destinationPath).toBe(join(root, 'preserve', '2026', '09', 'photo.jpg'))
    expect(await exists(result.destinationPath)).toBe(true)
    expect(await exists(sourcePath)).toBe(false)
    expect(await readFile(result.destinationPath, 'utf8')).toBe('hello-photo')
  })

  it('disambiguates colliding filenames', async () => {
    const root = await makeTemp('yaadein-work-')
    const sourceDir = await makeTemp('yaadein-src-')
    const monthDir = join(root, 'duplicate', '2026', '09')
    await mkdir(monthDir, { recursive: true })
    await writeFile(join(monthDir, 'photo.jpg'), 'already-there')

    const sourcePath = join(sourceDir, 'photo.jpg')
    await writeFile(sourcePath, 'new-copy')

    const result = await moveMediaIntoWorkingFolder({
      sourcePath,
      workingRoot: root,
      bucket: 'duplicate',
      captureDate: new Date('2026-09-05T15:00:00.000Z'),
      nameDisambiguator: 'deadbeef',
    })

    expect(result.destinationPath).toBe(
      join(root, 'duplicate', '2026', '09', 'photo_deadbeef.jpg'),
    )
    expect(await readFile(result.destinationPath, 'utf8')).toBe('new-copy')
    expect(await readFile(join(monthDir, 'photo.jpg'), 'utf8')).toBe('already-there')
  })

  it('defaults YYYY/MM from the oldest filesystem timestamp when captureDate is omitted', async () => {
    const root = await makeTemp('yaadein-work-')
    const sourceDir = await makeTemp('yaadein-src-')
    const sourcePath = join(sourceDir, 'dated.jpg')
    await writeFile(sourcePath, 'payload')

    const { utimes } = await import('node:fs/promises')
    const stamp = new Date('2023-04-18T10:30:00.000Z')
    await utimes(sourcePath, stamp, stamp)

    const result = await moveMediaIntoWorkingFolder({
      sourcePath,
      workingRoot: root,
      bucket: 'preserve',
    })

    expect(result.yearMonth).toBe('2023/04')
    expect(result.destinationPath).toBe(join(root, 'preserve', '2023', '04', 'dated.jpg'))
  })
})
