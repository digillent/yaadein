import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import { restorePreserveFromCloud } from './restorePreserve'
import type { MediaDecisionDocument } from '../../shared/decisionTypes'
import type { BlobMediaStore } from '../blob/blobUploader'

function sha256(bytes: string): string {
  return createHash('sha256').update(bytes).digest('hex')
}

function acceptedDoc(overrides: Partial<MediaDecisionDocument> & { contentHash: string; fileSize: number }): MediaDecisionDocument {
  return {
    id: overrides.contentHash,
    userId: 'oid-1',
    contentHash: overrides.contentHash,
    fileSize: overrides.fileSize,
    decision: 'ACCEPTED',
    decidedAt: '2026-01-15T00:00:00.000Z',
    organizeDate: '2026-01-15T00:00:00.000Z',
    originalFilename: 'photo.jpg',
    cloudStatus: 'SYNCED',
    cloudObjectId: `oid-1/${overrides.contentHash}`,
    ...overrides,
  }
}

describe('restorePreserveFromCloud', () => {
  it('downloads, verifies hash, and writes preserve/YYYY/MM', async () => {
    const work = mkdtempSync(join(tmpdir(), 'yaadein-restore-'))
    const bytes = 'restore-bytes-ok'
    const hash = sha256(bytes)
    const blobs: BlobMediaStore = {
      uploadFile: vi.fn(),
      deleteFile: vi.fn(),
      downloadFile: vi.fn(async ({ localPath }) => {
        writeFileSync(localPath, bytes)
        return { cloudObjectId: `oid-1/${hash}` }
      }),
    }

    const result = await restorePreserveFromCloud(work, {
      decisions: {
        requireUserId: () => 'oid-1',
        listAcceptedSynced: async () => [
          acceptedDoc({ contentHash: hash, fileSize: bytes.length }),
        ],
      },
      blobs,
    })

    expect(result.restored).toBe(1)
    expect(result.failed).toBe(0)
    const dest = result.results[0]
    expect(dest?.outcome).toBe('restored')
    if (dest?.outcome === 'restored') {
      expect(dest.destinationPath).toContain(join('preserve', '2026', '01'))
      expect(readFileSync(dest.destinationPath, 'utf8')).toBe(bytes)
    }
  })

  it('skips when preserve file already matches hash', async () => {
    const work = mkdtempSync(join(tmpdir(), 'yaadein-restore-skip-'))
    const bytes = 'already-there'
    const hash = sha256(bytes)
    const destDir = join(work, 'preserve', '2026', '01')
    mkdirSync(destDir, { recursive: true })
    const existing = join(destDir, 'photo.jpg')
    writeFileSync(existing, bytes)

    const downloadFile = vi.fn()
    const result = await restorePreserveFromCloud(work, {
      decisions: {
        requireUserId: () => 'oid-1',
        listAcceptedSynced: async () => [
          acceptedDoc({ contentHash: hash, fileSize: bytes.length }),
        ],
      },
      blobs: { uploadFile: vi.fn(), downloadFile, deleteFile: vi.fn() },
    })

    expect(result.skipped).toBe(1)
    expect(downloadFile).not.toHaveBeenCalled()
    expect(existsSync(existing)).toBe(true)
  })

  it('fails closed on hash mismatch and leaves no partial file', async () => {
    const work = mkdtempSync(join(tmpdir(), 'yaadein-restore-fail-'))
    const expected = 'expected-bytes'
    const hash = sha256(expected)
    const blobs: BlobMediaStore = {
      uploadFile: vi.fn(),
      deleteFile: vi.fn(),
      downloadFile: vi.fn(async ({ localPath }) => {
        writeFileSync(localPath, 'wrong-bytes')
        return { cloudObjectId: `oid-1/${hash}` }
      }),
    }

    const result = await restorePreserveFromCloud(work, {
      decisions: {
        requireUserId: () => 'oid-1',
        listAcceptedSynced: async () => [
          acceptedDoc({ contentHash: hash, fileSize: expected.length }),
        ],
      },
      blobs,
    })

    expect(result.failed).toBe(1)
    expect(result.results[0]).toMatchObject({ outcome: 'failed' })
    expect(result.results[0]?.outcome === 'failed' && result.results[0].error).toMatch(/Hash mismatch/)
  })
})
