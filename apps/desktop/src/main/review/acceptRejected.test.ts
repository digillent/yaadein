import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { acceptRejectedMedia } from './acceptRejected'
import { DecisionRepository, type CosmosDecisionStore } from '../cosmos/decisionRepository'
import type { MediaDecisionDocument } from '../../shared/decisionTypes'
import type { MediaInspection } from '../../shared/mediaTypes'
import type { BlobUploadStore } from '../blob/blobUploader'

function sampleInspection(sourcePath: string): MediaInspection {
  return {
    sourcePath,
    contentHash: 'hash-rej-accept-1',
    fileSize: 4,
    mediaType: 'image/jpeg',
    captureDate: null,
    organizeDate: '2026-01-01T00:00:00.000Z',
    organizeDateSource: 'filesystem',
    width: 10,
    height: 10,
    duration: null,
    tags: { people: [], places: [], events: [] },
    originalFilename: 'junk.jpg',
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

describe('acceptRejectedMedia', () => {
  it('rejects paths outside rejected/', async () => {
    const work = mkdtempSync(join(tmpdir(), 'yaadein-acc-rej-work-'))
    mkdirSync(join(work, 'preserve', '2026', '01'), { recursive: true })
    const preserveFile = join(work, 'preserve', '2026', '01', 'keep.jpg')
    writeFileSync(preserveFile, 'keep')
    const decisions = new DecisionRepository(createMemoryStore(), () => 'oid-1')
    const blobs: BlobUploadStore = {
      async uploadFile() {
        return { cloudObjectId: 'x', blobUrl: 'https://example/x' }
      },
      async downloadFile() {
        throw new Error('not used')
      },
    }

    await expect(
      acceptRejectedMedia({
        inspection: sampleInspection(preserveFile),
        userId: 'oid-1',
        workingRoot: work,
        decisions,
        blobs,
      }),
    ).rejects.toThrow(/under rejected/)
  })

  it('upserts ACCEPTED over REJECTED then moves to preserve/', async () => {
    const work = mkdtempSync(join(tmpdir(), 'yaadein-acc-rej-work-'))
    mkdirSync(join(work, 'rejected', '2026', '01'), { recursive: true })
    const rejectedFile = join(work, 'rejected', '2026', '01', 'junk.jpg')
    writeFileSync(rejectedFile, 'junk')
    const store = createMemoryStore()
    const decisions = new DecisionRepository(store, () => 'oid-1')
    await decisions.upsertRejected({ contentHash: 'hash-rej-accept-1', fileSize: 4 })

    const blobs: BlobUploadStore = {
      async uploadFile() {
        return { cloudObjectId: 'oid-1/hash-rej-accept-1', blobUrl: 'https://example/b' }
      },
      async downloadFile() {
        throw new Error('not used')
      },
    }

    const moveFile = vi.fn(async () => ({
      destinationPath: join(work, 'preserve', '2026', '01', 'junk.jpg'),
      bucket: 'preserve' as const,
      yearMonth: '2026/01',
    }))

    const result = await acceptRejectedMedia({
      inspection: sampleInspection(rejectedFile),
      userId: 'oid-1',
      workingRoot: work,
      decisions,
      blobs,
      moveFile,
    })

    expect(result.document.decision).toBe('ACCEPTED')
    expect(result.document.cloudStatus).toBe('SYNCED')
    expect(result.sourceMoved).toBe(true)
    expect(moveFile).toHaveBeenCalledWith(
      expect.objectContaining({ bucket: 'preserve', sourcePath: rejectedFile }),
    )
    const stored = await store.readById('hash-rej-accept-1', 'oid-1')
    expect(stored?.decision).toBe('ACCEPTED')
  })
})
