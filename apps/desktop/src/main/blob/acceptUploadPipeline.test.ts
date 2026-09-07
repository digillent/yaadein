import { existsSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { acceptAndUploadMedia } from './acceptUploadPipeline'
import { assertBlobConfig, buildCloudObjectId, getBlobPublicConfig } from './blobConfig'
import type { BlobUploadStore } from './blobUploader'
import { DecisionRepository, type CosmosDecisionStore } from '../cosmos/decisionRepository'
import type { MediaDecisionDocument } from '../../shared/decisionTypes'
import type { MediaInspection } from '../../shared/mediaTypes'

function sampleInspection(sourcePath: string): MediaInspection {
  return {
    sourcePath,
    contentHash: 'abc123hash',
    fileSize: 12,
    mediaType: 'image/jpeg',
    captureDate: null,
    organizeDate: '2026-01-01T00:00:00.000Z',
    organizeDateSource: 'filesystem',
    width: 10,
    height: 10,
    duration: null,
    tags: { people: [], places: [], events: [] },
    originalFilename: 'sample.jpg',
  }
}

function createMemoryStore(): CosmosDecisionStore & { docs: Map<string, MediaDecisionDocument> } {
  const docs = new Map<string, MediaDecisionDocument>()
  return {
    docs,
    async readById(id, userId) {
      const doc = docs.get(id)
      return doc && doc.userId === userId ? doc : null
    },
    async queryByHashes(userId, hashes) {
      return hashes
        .map((h) => docs.get(h))
        .filter((d): d is MediaDecisionDocument => !!d && d.userId === userId)
    },
    async upsert(doc) {
      docs.set(doc.id, doc)
      return doc
    },
  }
}

describe('blobConfig', () => {
  it('builds cloudObjectId as userId/contentHash', () => {
    expect(buildCloudObjectId('oid-1', 'hash-1')).toBe('oid-1/hash-1')
  })

  it('assertBlobConfig requires account URL', () => {
    expect(() =>
      assertBlobConfig({
        accountUrl: '',
        containerName: 'media',
        scope: 'https://storage.azure.com/user_impersonation',
      }),
    ).toThrow(/account URL/)
  })

  it('defaults container name', () => {
    const previous = process.env.YAADEIN_BLOB_ACCOUNT_URL
    process.env.YAADEIN_BLOB_ACCOUNT_URL = 'https://example.blob.core.windows.net'
    try {
      expect(getBlobPublicConfig().containerName).toBe('media')
    } finally {
      process.env.YAADEIN_BLOB_ACCOUNT_URL = previous
    }
  })
})

describe('acceptAndUploadMedia', () => {
  it('transitions PENDING → UPLOADING → SYNCED and never moves source', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'yaadein-m6-'))
    const sourcePath = join(dir, 'sample.jpg')
    writeFileSync(sourcePath, 'hello-bytes')

    const store = createMemoryStore()
    const decisions = new DecisionRepository(store, () => 'oid-1')
    const blobs: BlobUploadStore = {
      uploadFile: vi.fn(async ({ cloudObjectId }) => ({
        cloudObjectId,
        blobUrl: `https://example.blob.core.windows.net/media/${cloudObjectId}`,
      })),
      downloadFile: vi.fn(),
      deleteFile: vi.fn(),
    }

    const result = await acceptAndUploadMedia({
      inspection: sampleInspection(sourcePath),
      userId: 'oid-1',
      decisions,
      blobs,
    })

    expect(result.statusTrail).toEqual(['PENDING', 'UPLOADING', 'SYNCED'])
    expect(result.document.cloudStatus).toBe('SYNCED')
    expect(result.cloudObjectId).toBe('oid-1/abc123hash')
    expect(result.sourceMoved).toBe(false)
    expect(existsSync(sourcePath)).toBe(true)
    expect(blobs.uploadFile).toHaveBeenCalledOnce()
  })

  it('marks FAILED on upload error and leaves source unmoved', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'yaadein-m6-fail-'))
    const sourcePath = join(dir, 'sample.jpg')
    writeFileSync(sourcePath, 'hello-bytes')

    const store = createMemoryStore()
    const decisions = new DecisionRepository(store, () => 'oid-1')
    const blobs: BlobUploadStore = {
      uploadFile: vi.fn(async () => {
        throw new Error('network down')
      }),
      downloadFile: vi.fn(),
      deleteFile: vi.fn(),
    }

    await expect(
      acceptAndUploadMedia({
        inspection: sampleInspection(sourcePath),
        userId: 'oid-1',
        decisions,
        blobs,
      }),
    ).rejects.toMatchObject({
      message: expect.stringContaining('Blob upload failed'),
      acceptUploadResult: expect.objectContaining({
        statusTrail: ['PENDING', 'UPLOADING', 'FAILED'],
        sourceMoved: false,
        document: expect.objectContaining({ cloudStatus: 'FAILED' }),
      }),
    })

    expect(existsSync(sourcePath)).toBe(true)
  })
})
