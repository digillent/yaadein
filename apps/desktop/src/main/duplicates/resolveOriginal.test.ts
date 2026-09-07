import { mkdirSync, mkdtempSync, writeFileSync, existsSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import {
  findPreserveFileByHash,
  resolveDuplicateComparePair,
} from './resolveOriginal'
import type { MediaDecisionDocument } from '../../shared/decisionTypes'
import type { BlobMediaStore } from '../blob/blobUploader'
import { createHash } from 'node:crypto'

function sha256(content: string): string {
  return createHash('sha256').update(content).digest('hex')
}

describe('findPreserveFileByHash', () => {
  it('finds preserve file with matching hash and size', async () => {
    const work = mkdtempSync(join(tmpdir(), 'yaadein-dup-find-'))
    mkdirSync(join(work, 'preserve', '2026', '01'), { recursive: true })
    const body = 'original-bytes'
    const path = join(work, 'preserve', '2026', '01', 'a.jpg')
    writeFileSync(path, body)
    const hash = sha256(body)
    const found = await findPreserveFileByHash(work, hash, Buffer.byteLength(body))
    expect(found).toBe(path)
  })
})

describe('resolveDuplicateComparePair', () => {
  it('returns unavailable when Cosms has no ACCEPTED doc (scan-peer)', async () => {
    const work = mkdtempSync(join(tmpdir(), 'yaadein-dup-work-'))
    mkdirSync(join(work, 'duplicate', '2026', '01'), { recursive: true })
    mkdirSync(join(work, 'preserve', '2026', '01'), { recursive: true })
    const body = 'peer-only'
    const preserveCopy = join(work, 'preserve', '2026', '01', 'stray.jpg')
    const dup = join(work, 'duplicate', '2026', '01', 'copy.jpg')
    writeFileSync(preserveCopy, body)
    writeFileSync(dup, body)
    const pair = await resolveDuplicateComparePair(work, dup, {
      decisions: {
        async lookupByHashes() {
          return []
        },
        requireUserId: () => 'oid-1',
      },
      blobs: { uploadFile: vi.fn(), downloadFile: vi.fn(), deleteFile: vi.fn() },
      downloadIfMissing: false,
    })
    expect(pair.original.status).toBe('unavailable')
    expect(pair.original.path).toBeNull()
    expect(pair.original.detail).toMatch(/ACCEPTED/)
  })

  it('matches Cosms ACCEPTED original in local preserve/', async () => {
    const work = mkdtempSync(join(tmpdir(), 'yaadein-dup-work-'))
    mkdirSync(join(work, 'duplicate', '2026', '01'), { recursive: true })
    mkdirSync(join(work, 'preserve', '2026', '01'), { recursive: true })
    const body = 'same-content-xyz'
    const hash = sha256(body)
    const original = join(work, 'preserve', '2026', '01', 'orig.jpg')
    const dup = join(work, 'duplicate', '2026', '01', 'copy.jpg')
    writeFileSync(original, body)
    writeFileSync(dup, body)

    const accepted: MediaDecisionDocument = {
      id: hash,
      userId: 'oid-1',
      contentHash: hash,
      fileSize: Buffer.byteLength(body),
      decision: 'ACCEPTED',
      decidedAt: new Date().toISOString(),
      cloudStatus: 'SYNCED',
      cloudObjectId: `oid-1/${hash}`,
      originalFilename: 'orig.jpg',
      organizeDate: '2026-01-15T00:00:00.000Z',
    }

    const pair = await resolveDuplicateComparePair(work, dup, {
      decisions: {
        async lookupByHashes() {
          return [accepted]
        },
        requireUserId: () => 'oid-1',
      },
      blobs: { uploadFile: vi.fn(), downloadFile: vi.fn(), deleteFile: vi.fn() },
    })

    expect(pair.original.status).toBe('local')
    expect(pair.original.path).toBe(original)
    expect(pair.contentHash).toBe(hash)
  })

  it('downloads ACCEPTED original into preserve when missing locally', async () => {
    const work = mkdtempSync(join(tmpdir(), 'yaadein-dup-work-'))
    mkdirSync(join(work, 'duplicate', '2026', '01'), { recursive: true })
    mkdirSync(join(work, 'preserve'), { recursive: true })
    const body = 'cloud-original'
    const hash = sha256(body)
    const dup = join(work, 'duplicate', '2026', '01', 'copy.jpg')
    writeFileSync(dup, body)

    const accepted: MediaDecisionDocument = {
      id: hash,
      userId: 'oid-1',
      contentHash: hash,
      fileSize: Buffer.byteLength(body),
      decision: 'ACCEPTED',
      decidedAt: new Date().toISOString(),
      cloudStatus: 'SYNCED',
      cloudObjectId: `oid-1/${hash}`,
      originalFilename: 'from-cloud.jpg',
      organizeDate: '2026-02-01T00:00:00.000Z',
    }

    const blobs: BlobMediaStore = {
      uploadFile: vi.fn(),
      deleteFile: vi.fn(),
      downloadFile: vi.fn(async ({ localPath }) => {
        writeFileSync(localPath, body)
        return { cloudObjectId: `oid-1/${hash}` }
      }),
    }

    const pair = await resolveDuplicateComparePair(work, dup, {
      decisions: {
        async lookupByHashes() {
          return [accepted]
        },
        requireUserId: () => 'oid-1',
      },
      blobs,
    })

    expect(pair.original.status).toBe('downloaded')
    expect(pair.original.path).toBeTruthy()
    expect(existsSync(pair.original.path!)).toBe(true)
    expect(readFileSync(pair.original.path!, 'utf8')).toBe(body)
    expect(blobs.downloadFile).toHaveBeenCalled()
  })

  it('refuses paths outside duplicate/', async () => {
    const work = mkdtempSync(join(tmpdir(), 'yaadein-dup-work-'))
    mkdirSync(join(work, 'preserve', '2026', '01'), { recursive: true })
    const keep = join(work, 'preserve', '2026', '01', 'keep.jpg')
    writeFileSync(keep, 'x')
    await expect(
      resolveDuplicateComparePair(work, keep, {
        decisions: {
          async lookupByHashes() {
            return []
          },
          requireUserId: () => 'oid-1',
        },
        blobs: { uploadFile: vi.fn(), downloadFile: vi.fn(), deleteFile: vi.fn() },
      }),
    ).rejects.toThrow(/under duplicate/)
  })
})
