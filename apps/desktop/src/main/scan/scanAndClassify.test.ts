import { mkdirSync, mkdtempSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import { walkMediaFiles } from './walkMediaFiles'
import { scanAndClassify } from './scanAndClassify'
import type { MediaDecisionDocument } from '../../shared/decisionTypes'

function sha256(bytes: string): string {
  return createHash('sha256').update(bytes).digest('hex')
}

describe('walkMediaFiles', () => {
  it('finds media files and skips buckets only under the working folder', async () => {
    const root = mkdtempSync(join(tmpdir(), 'yaadein-walk-'))
    writeFileSync(join(root, 'a.jpg'), 'a')
    writeFileSync(join(root, 'notes.txt'), 'skip')
    mkdirSync(join(root, 'nested'), { recursive: true })
    writeFileSync(join(root, 'nested', 'b.png'), 'b')
    mkdirSync(join(root, 'preserve', '2025', '01'), { recursive: true })
    writeFileSync(join(root, 'preserve', '2025', '01', 'kept.jpg'), 'kept')

    const found = await walkMediaFiles([root], { workingRoot: root })
    expect(found.map((p) => p.slice(root.length + 1)).sort()).toEqual(['a.jpg', 'nested/b.png'])
  })

  it('skips .DS_Store and other non-media', async () => {
    const root = mkdtempSync(join(tmpdir(), 'yaadein-walk-ds-'))
    writeFileSync(join(root, 'a.jpg'), 'a')
    writeFileSync(join(root, '.DS_Store'), 'mac')
    writeFileSync(join(root, 'Thumbs.db'), 'win')
    const found = await walkMediaFiles([root])
    expect(found).toHaveLength(1)
    expect(found[0]?.endsWith('a.jpg')).toBe(true)
  })

  it('scans rejected/duplicate/preserve under a scan root that is not the working folder', async () => {
    const scan = mkdtempSync(join(tmpdir(), 'yaadein-scan-root-'))
    const work = mkdtempSync(join(tmpdir(), 'yaadein-work-root-'))
    mkdirSync(join(scan, 'rejected', '2022', '03'), { recursive: true })
    mkdirSync(join(scan, 'duplicate', '2022', '04'), { recursive: true })
    mkdirSync(join(scan, 'preserve', '2022', '05'), { recursive: true })
    mkdirSync(join(scan, 'vacation'), { recursive: true })
    mkdirSync(join(work, 'rejected', '2022', '03'), { recursive: true })
    writeFileSync(join(scan, 'rejected', '2022', '03', 'shot.jpg'), 'scan-rej')
    writeFileSync(join(scan, 'duplicate', '2022', '04', 'dup.jpg'), 'scan-dup')
    writeFileSync(join(scan, 'preserve', '2022', '05', 'keep.jpg'), 'scan-pre')
    writeFileSync(join(scan, 'vacation', 'trip.jpg'), 'scan-trip')
    writeFileSync(join(work, 'rejected', '2022', '03', 'other.jpg'), 'work-bytes')

    const found = await walkMediaFiles([scan], { workingRoot: work })
    expect(found.map((p) => p.slice(scan.length + 1)).sort()).toEqual([
      'duplicate/2022/04/dup.jpg',
      'preserve/2022/05/keep.jpg',
      'rejected/2022/03/shot.jpg',
      'vacation/trip.jpg',
    ])
  })

  it('when scan root is the working folder, skips its preserve/duplicate/rejected buckets', async () => {
    const work = mkdtempSync(join(tmpdir(), 'yaadein-work-as-scan-'))
    mkdirSync(join(work, 'rejected', '2022', '01'), { recursive: true })
    writeFileSync(join(work, 'loose.jpg'), 'loose')
    writeFileSync(join(work, 'rejected', '2022', '01', 'in-bucket.jpg'), 'bucket')

    const found = await walkMediaFiles([work], { workingRoot: work })
    expect(found).toEqual([join(work, 'loose.jpg')])
  })
})

describe('scanAndClassify', () => {
  it('fails closed when not signed in', async () => {
    await expect(
      scanAndClassify(
        { scanRoots: ['/tmp'], workingRoot: '/tmp/work' },
        {
          requireSignedIn: () => {
            throw new Error('Sign in required')
          },
          decisions: { lookupByHashes: vi.fn(async () => []) },
        },
      ),
    ).rejects.toThrow(/Sign in required/)
  })

  it('moves rejected/accepted and skips unknowns with batch lookup', async () => {
    const root = mkdtempSync(join(tmpdir(), 'yaadein-scan-'))
    const work = mkdtempSync(join(tmpdir(), 'yaadein-work-'))
    const rejectedBytes = 'rejected-bytes'
    const acceptedBytes = 'accepted-bytes'
    const unknownBytes = 'unknown-bytes'
    writeFileSync(join(root, 'rej.jpg'), rejectedBytes)
    writeFileSync(join(root, 'acc.jpg'), acceptedBytes)
    writeFileSync(join(root, 'unk.jpg'), unknownBytes)

    const rejectedHash = sha256(rejectedBytes)
    const acceptedHash = sha256(acceptedBytes)

    const lookup = vi.fn(async (hashes: string[]) => {
      const docs: MediaDecisionDocument[] = []
      if (hashes.includes(rejectedHash)) {
        docs.push({
          id: rejectedHash,
          userId: 'oid',
          contentHash: rejectedHash,
          fileSize: rejectedBytes.length,
          decision: 'REJECTED',
          decidedAt: '2026-01-01T00:00:00.000Z',
        })
      }
      if (hashes.includes(acceptedHash)) {
        docs.push({
          id: acceptedHash,
          userId: 'oid',
          contentHash: acceptedHash,
          fileSize: acceptedBytes.length,
          decision: 'ACCEPTED',
          cloudStatus: 'SYNCED',
          decidedAt: '2026-01-01T00:00:00.000Z',
        })
      }
      return docs
    })

    const moves: Array<{ sourcePath: string; bucket: string }> = []
    const progressPhases: string[] = []

    const result = await scanAndClassify(
      { scanRoots: [root], workingRoot: work },
      {
        requireSignedIn: () => undefined,
        decisions: { lookupByHashes: lookup },
        batchSize: 10,
        moveFile: async (input) => {
          moves.push({ sourcePath: input.sourcePath, bucket: input.bucket })
          return {
            destinationPath: join(work, input.bucket, 'moved.jpg'),
            bucket: input.bucket,
            yearMonth: '2026/01',
          }
        },
        onProgress: (p) => {
          progressPhases.push(p.phase)
        },
      },
    )

    expect(lookup).toHaveBeenCalled()
    expect(result.filesFound).toBe(3)
    expect(result.movedRejected).toBe(1)
    expect(result.movedDuplicate).toBe(1)
    expect(result.skippedUnknown).toBe(1)
    expect(result.errors).toBe(0)
    expect(moves).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ bucket: 'rejected' }),
        expect.objectContaining({ bucket: 'duplicate' }),
      ]),
    )
    expect(progressPhases).toContain('sizing')
    expect(progressPhases).toContain('looking_up')
    expect(progressPhases.at(-1)).toBe('done')
    expect(existsSync(join(root, 'unk.jpg'))).toBe(true)
    expect(result.results.find((r) => r.outcome === 'moved_duplicate')).toMatchObject({
      duplicateOf: 'cosmos_accepted',
    })
  })

  it('moves in-batch same-hash peers to duplicate/ without Cosms docs', async () => {
    const root = mkdtempSync(join(tmpdir(), 'yaadein-scan-peer-'))
    const work = mkdtempSync(join(tmpdir(), 'yaadein-work-'))
    const bytes = 'identical-bytes'
    writeFileSync(join(root, 'one.jpg'), bytes)
    writeFileSync(join(root, 'two.jpg'), bytes)
    writeFileSync(join(root, 'other.jpg'), 'different')

    const moves: Array<{ sourcePath: string; bucket: string }> = []
    const result = await scanAndClassify(
      { scanRoots: [root], workingRoot: work },
      {
        requireSignedIn: () => undefined,
        decisions: { lookupByHashes: vi.fn(async () => []) },
        moveFile: async (input) => {
          moves.push({ sourcePath: input.sourcePath, bucket: input.bucket })
          return {
            destinationPath: join(work, input.bucket, 'moved.jpg'),
            bucket: input.bucket,
            yearMonth: '2026/01',
          }
        },
      },
    )

    expect(result.peerCandidateSizeCount).toBeGreaterThanOrEqual(1)
    expect(result.skippedUnknown).toBe(2) // first identical + other.jpg
    expect(result.movedDuplicate).toBe(1)
    expect(moves).toEqual([expect.objectContaining({ bucket: 'duplicate' })])
    expect(result.results.find((r) => r.outcome === 'moved_duplicate')).toMatchObject({
      duplicateOf: 'scan_peer',
    })
    expect(existsSync(join(root, 'one.jpg')) || existsSync(join(root, 'two.jpg'))).toBe(true)
  })

  it('fails closed when Cosmos lookup throws', async () => {
    const root = mkdtempSync(join(tmpdir(), 'yaadein-scan-fail-'))
    writeFileSync(join(root, 'a.jpg'), 'x')

    await expect(
      scanAndClassify(
        { scanRoots: [root], workingRoot: mkdtempSync(join(tmpdir(), 'yaadein-work-')) },
        {
          requireSignedIn: () => undefined,
          decisions: {
            lookupByHashes: vi.fn(async () => {
              throw new Error('offline')
            }),
          },
        },
      ),
    ).rejects.toThrow(/Cosmos lookup failed/)
  })

  it('removes empty and junk-only folders under the scan root after moves', async () => {
    const root = mkdtempSync(join(tmpdir(), 'yaadein-scan-prune-'))
    const work = mkdtempSync(join(tmpdir(), 'yaadein-work-prune-'))
    const nested = join(root, 'vacation', 'day1')
    mkdirSync(nested, { recursive: true })
    const body = 'prune-me'
    const hash = sha256(body)
    writeFileSync(join(nested, 'shot.jpg'), body)
    writeFileSync(join(nested, '.DS_Store'), 'mac')
    writeFileSync(join(root, 'vacation', 'Thumbs.db'), 'win')

    await scanAndClassify(
      { scanRoots: [root], workingRoot: work },
      {
        requireSignedIn: () => undefined,
        decisions: {
          lookupByHashes: async () => [
            {
              id: hash,
              userId: 'oid',
              contentHash: hash,
              fileSize: body.length,
              decision: 'REJECTED',
              decidedAt: '2026-01-01T00:00:00.000Z',
            },
          ],
        },
      },
    )

    expect(existsSync(root)).toBe(true)
    expect(existsSync(join(root, 'vacation'))).toBe(false)
  })
})
