import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { rejectPreserveMedia } from './rejectPreserve'
import { DecisionRepository, type CosmosDecisionStore } from '../cosmos/decisionRepository'
import type { MediaDecisionDocument } from '../../shared/decisionTypes'
import type { MediaInspection } from '../../shared/mediaTypes'
import type { BlobMediaStore } from '../blob/blobUploader'
import { ensureWorkingFolder } from '../workingFolder'

function sampleInspection(sourcePath: string): MediaInspection {
  return {
    sourcePath,
    contentHash: 'hash-preserve-rej-1',
    fileSize: 4,
    mediaType: 'image/jpeg',
    captureDate: null,
    organizeDate: '2026-01-01T00:00:00.000Z',
    organizeDateSource: 'filesystem',
    width: 10,
    height: 10,
    duration: null,
    tags: { people: [], places: [], events: [] },
    originalFilename: 'keep.jpg',
  }
}

function createMemoryStore(): CosmosDecisionStore {
  const docs = new Map<string, MediaDecisionDocument>()
  return {
    async readById(id, userId) {
      const doc = docs.get(id)
      return doc && doc.userId === userId ? doc : null
    },
    async queryByHashes(userId, hashes) {
      return [...docs.values()].filter(
        (d) => d.userId === userId && hashes.includes(d.contentHash),
      )
    },
    async queryAcceptedSynced() {
      return [...docs.values()].filter((d) => d.decision === 'ACCEPTED' && d.cloudStatus === 'SYNCED')
    },
    async upsert(doc) {
      docs.set(doc.id, doc)
      return doc
    },
  }
}

function mockBlobs(): BlobMediaStore {
  return {
    uploadFile: vi.fn(),
    downloadFile: vi.fn(),
    deleteFile: vi.fn(async () => undefined),
  }
}

describe('rejectPreserveMedia', () => {
  it('refuses paths outside preserve/', async () => {
    const work = mkdtempSync(join(tmpdir(), 'yaadein-rej-pres-'))
    mkdirSync(join(work, 'rejected', '2026', '01'), { recursive: true })
    const path = join(work, 'rejected', '2026', '01', 'a.jpg')
    writeFileSync(path, 'abcd')
    const decisions = new DecisionRepository(createMemoryStore(), () => 'oid-1')

    await expect(
      rejectPreserveMedia({
        inspection: sampleInspection(path),
        workingRoot: work,
        decisions,
        blobs: mockBlobs(),
      }),
    ).rejects.toThrow(/under preserve/)
  })

  it('refuses non-media paths', async () => {
    const work = mkdtempSync(join(tmpdir(), 'yaadein-rej-pres-'))
    mkdirSync(join(work, 'preserve', '2026', '01'), { recursive: true })
    const path = join(work, 'preserve', '2026', '01', '.DS_Store')
    writeFileSync(path, 'x')
    const decisions = new DecisionRepository(createMemoryStore(), () => 'oid-1')

    await expect(
      rejectPreserveMedia({
        inspection: sampleInspection(path),
        workingRoot: work,
        decisions,
        blobs: mockBlobs(),
      }),
    ).rejects.toThrow(/previewable media/)
  })

  it('deletes blob, upserts REJECTED, and moves to rejected/', async () => {
    const work = mkdtempSync(join(tmpdir(), 'yaadein-rej-pres-'))
    await ensureWorkingFolder(work)
    mkdirSync(join(work, 'preserve', '2026', '01'), { recursive: true })
    const path = join(work, 'preserve', '2026', '01', 'keep.jpg')
    writeFileSync(path, 'abcd')

    const store = createMemoryStore()
    const decisions = new DecisionRepository(store, () => 'oid-1')
    await decisions.upsertAccepted({
      contentHash: 'hash-preserve-rej-1',
      fileSize: 4,
      mediaType: 'image/jpeg',
      originalFilename: 'keep.jpg',
      captureDate: null,
      organizeDate: '2026-01-01T00:00:00.000Z',
      width: 10,
      height: 10,
      duration: null,
      tags: { people: [], places: [], events: [] },
      cloudStatus: 'SYNCED',
    })
    await decisions.updateCloudSync('hash-preserve-rej-1', {
      cloudStatus: 'SYNCED',
      cloudObjectId: 'oid-1/hash-preserve-rej-1',
    })

    const blobs = mockBlobs()
    const result = await rejectPreserveMedia({
      inspection: sampleInspection(path),
      workingRoot: work,
      decisions,
      blobs,
    })

    expect(blobs.deleteFile).toHaveBeenCalledWith({ cloudObjectId: 'oid-1/hash-preserve-rej-1' })
    expect(result.document.decision).toBe('REJECTED')
    expect(result.sourceMoved).toBe(true)
    expect(existsSync(path)).toBe(false)
    expect(existsSync(result.destinationPath)).toBe(true)
    expect(result.destinationPath.includes('rejected')).toBe(true)
    const stored = await store.readById('hash-preserve-rej-1', 'oid-1')
    expect(stored?.decision).toBe('REJECTED')
  })
})
