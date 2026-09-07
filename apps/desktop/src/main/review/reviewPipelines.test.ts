import { existsSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { acceptUnknownMedia } from './acceptUnknown'
import { rejectUnknownMedia } from './rejectUnknown'
import { DecisionRepository, type CosmosDecisionStore } from '../cosmos/decisionRepository'
import type { MediaDecisionDocument } from '../../shared/decisionTypes'
import type { MediaInspection } from '../../shared/mediaTypes'
import type { BlobUploadStore } from '../blob/blobUploader'

function sampleInspection(sourcePath: string): MediaInspection {
  return {
    sourcePath,
    contentHash: 'hash-review-1',
    fileSize: 11,
    mediaType: 'image/jpeg',
    captureDate: null,
    organizeDate: '2026-01-01T00:00:00.000Z',
    organizeDateSource: 'filesystem',
    width: 10,
    height: 10,
    duration: null,
    tags: { people: [], places: [], events: [] },
    originalFilename: 'x.jpg',
  }
}

function createMemoryStore(): CosmosDecisionStore {
  const docs = new Map<string, MediaDecisionDocument>()
  return {
    async readById(id, userId) {
      const doc = docs.get(id)
      return doc && doc.userId === userId ? doc : null
    },
    async queryByHashes() {
      return [...docs.values()]
    },
    async upsert(doc) {
      docs.set(doc.id, doc)
      return doc
    },
  }
}

describe('rejectUnknownMedia', () => {
  it('writes Cosms REJECTED then moves to rejected/', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'yaadein-m8-rej-'))
    const sourcePath = join(dir, 'x.jpg')
    writeFileSync(sourcePath, 'hello-world')
    const work = mkdtempSync(join(tmpdir(), 'yaadein-m8-work-'))
    const decisions = new DecisionRepository(createMemoryStore(), () => 'oid-1')
    const moveFile = vi.fn(async () => ({
      destinationPath: join(work, 'rejected', 'x.jpg'),
      bucket: 'rejected' as const,
      yearMonth: '2026/01',
    }))

    const result = await rejectUnknownMedia({
      inspection: sampleInspection(sourcePath),
      workingRoot: work,
      decisions,
      moveFile,
    })

    expect(result.sourceMoved).toBe(true)
    expect(result.document.decision).toBe('REJECTED')
    expect(moveFile).toHaveBeenCalledWith(
      expect.objectContaining({ bucket: 'rejected', sourcePath }),
    )
  })
})

describe('acceptUnknownMedia', () => {
  it('moves to preserve/ only after Blob SYNCED', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'yaadein-m8-acc-'))
    const sourcePath = join(dir, 'x.jpg')
    writeFileSync(sourcePath, 'hello-world')
    const work = mkdtempSync(join(tmpdir(), 'yaadein-m8-work-'))
    const decisions = new DecisionRepository(createMemoryStore(), () => 'oid-1')
    const callOrder: string[] = []
    const blobs: BlobUploadStore = {
      uploadFile: vi.fn(async ({ cloudObjectId }) => {
        callOrder.push('upload')
        return {
          cloudObjectId,
          blobUrl: `https://example.blob.core.windows.net/media/${cloudObjectId}`,
        }
      }),
    }
    const moveFile = vi.fn(async () => {
      callOrder.push('move')
      return {
        destinationPath: join(work, 'preserve', 'x.jpg'),
        bucket: 'preserve' as const,
        yearMonth: '2026/01',
      }
    })

    const result = await acceptUnknownMedia({
      inspection: sampleInspection(sourcePath),
      userId: 'oid-1',
      workingRoot: work,
      decisions,
      blobs,
      moveFile,
    })

    expect(result.sourceMoved).toBe(true)
    expect(result.document.cloudStatus).toBe('SYNCED')
    expect(callOrder).toEqual(['upload', 'move'])
    expect(moveFile).toHaveBeenCalledWith(
      expect.objectContaining({ bucket: 'preserve', sourcePath }),
    )
  })

  it('does not move source when Blob upload fails', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'yaadein-m8-fail-'))
    const sourcePath = join(dir, 'x.jpg')
    writeFileSync(sourcePath, 'hello-world')
    const work = mkdtempSync(join(tmpdir(), 'yaadein-m8-work-'))
    const decisions = new DecisionRepository(createMemoryStore(), () => 'oid-1')
    const moveFile = vi.fn(async () => ({
      destinationPath: join(work, 'preserve', 'x.jpg'),
      bucket: 'preserve' as const,
      yearMonth: '2026/01',
    }))
    const blobs: BlobUploadStore = {
      uploadFile: vi.fn(async () => {
        throw new Error('network down')
      }),
    }

    await expect(
      acceptUnknownMedia({
        inspection: sampleInspection(sourcePath),
        userId: 'oid-1',
        workingRoot: work,
        decisions,
        blobs,
        moveFile,
      }),
    ).rejects.toThrow(/Blob upload failed/)

    expect(moveFile).not.toHaveBeenCalled()
    expect(existsSync(sourcePath)).toBe(true)
  })
})
