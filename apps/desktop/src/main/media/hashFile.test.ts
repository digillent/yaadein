import { afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync, utimesSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  clearHashFileCache,
  hashFileContent,
  hashFileContentCached,
} from './hashFile'

describe('hashFileContentCached', () => {
  const dirs: string[] = []

  afterEach(() => {
    clearHashFileCache()
    for (const dir of dirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('returns the same digest as hashFileContent and skips re-read on stable mtime/size', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'yaadein-hash-cache-'))
    dirs.push(dir)
    const file = join(dir, 'a.jpg')
    writeFileSync(file, 'payload-v1')
    const now = new Date()
    utimesSync(file, now, now)

    const first = await hashFileContentCached(file)
    const direct = await hashFileContent(file)
    expect(first.contentHash).toBe(direct.contentHash)

    const second = await hashFileContentCached(file)
    expect(second).toEqual(first)

    writeFileSync(file, 'payload-v2-longer')
    const later = new Date(now.getTime() + 2000)
    utimesSync(file, later, later)
    const third = await hashFileContentCached(file)
    expect(third.contentHash).not.toBe(first.contentHash)
    expect(third.fileSize).toBe(Buffer.byteLength('payload-v2-longer'))
  })
})
