import { mkdirSync, mkdtempSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  assertCleanupBucket,
  deleteCleanupFiles,
  isPathInsideRoot,
  listCleanupFiles,
} from './cleanupLocal'

describe('cleanupLocal', () => {
  it('only allows rejected and duplicate buckets', () => {
    expect(() => assertCleanupBucket('preserve')).toThrow(/never preserve/)
    expect(() => assertCleanupBucket('rejected')).not.toThrow()
  })

  it('detects path containment safely', () => {
    expect(isPathInsideRoot('/work/rejected', '/work/rejected/2026/01/a.jpg')).toBe(true)
    expect(isPathInsideRoot('/work/rejected', '/work/preserve/a.jpg')).toBe(false)
    expect(isPathInsideRoot('/work/rejected', '/work/rejected-evil/a.jpg')).toBe(false)
  })

  it('lists and deletes only under the cleanup bucket', async () => {
    const root = mkdtempSync(join(tmpdir(), 'yaadein-clean-'))
    mkdirSync(join(root, 'rejected', '2026', '01'), { recursive: true })
    mkdirSync(join(root, 'preserve', '2026', '01'), { recursive: true })
    mkdirSync(join(root, 'duplicate', '2026', '01'), { recursive: true })
    const rejectedFile = join(root, 'rejected', '2026', '01', 'junk.jpg')
    const preserveFile = join(root, 'preserve', '2026', '01', 'keep.jpg')
    const dupFile = join(root, 'duplicate', '2026', '01', 'copy.jpg')
    writeFileSync(rejectedFile, 'junk')
    writeFileSync(preserveFile, 'keep')
    writeFileSync(dupFile, 'dup')

    const listed = await listCleanupFiles(root, 'rejected')
    expect(listed.files.map((f) => f.relativePath)).toEqual(['2026/01/junk.jpg'])
    expect(listed.files[0]?.yearMonth).toBe('2026/01')

    const deleted = await deleteCleanupFiles(root, 'rejected', [rejectedFile])
    expect(deleted.deleted).toEqual([rejectedFile])
    expect(existsSync(rejectedFile)).toBe(false)
    expect(existsSync(preserveFile)).toBe(true)

    const refused = await deleteCleanupFiles(root, 'rejected', [preserveFile])
    expect(refused.deleted).toEqual([])
    expect(refused.failed[0]?.error).toMatch(/outside cleanup bucket|preserve/)
    expect(existsSync(preserveFile)).toBe(true)
  })

  it('deletes duplicates without touching Cosms concerns (local only)', async () => {
    const root = mkdtempSync(join(tmpdir(), 'yaadein-clean-dup-'))
    mkdirSync(join(root, 'duplicate', '2025', '12'), { recursive: true })
    const dup = join(root, 'duplicate', '2025', '12', 'a.jpg')
    writeFileSync(dup, 'x')
    const result = await deleteCleanupFiles(root, 'duplicate', [dup])
    expect(result.deleted).toEqual([dup])
    expect(existsSync(dup)).toBe(false)
  })
})
