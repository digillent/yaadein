import { describe, expect, it, vi } from 'vitest'
import {
  assertWritableDecision,
  buildAcceptedDocument,
  buildRejectedDocument,
} from './decisionDocuments'
import { DecisionRepository, type CosmosDecisionStore } from './decisionRepository'
import { assertCosmosConfig, getCosmosPublicConfig } from './cosmosConfig'

describe('decisionDocuments', () => {
  it('builds lean REJECTED docs with id = contentHash and partition userId', () => {
    const doc = buildRejectedDocument('oid-1', {
      contentHash: 'abc123',
      fileSize: 10,
      decidedAt: '2026-09-06T00:00:00.000Z',
    })
    expect(doc).toMatchObject({
      id: 'abc123',
      userId: 'oid-1',
      contentHash: 'abc123',
      fileSize: 10,
      decision: 'REJECTED',
      cloudStatus: 'NOT_REQUIRED',
    })
  })

  it('builds full ACCEPTED docs and defaults cloudStatus to PENDING', () => {
    const doc = buildAcceptedDocument('oid-1', {
      contentHash: 'def456',
      fileSize: 99,
      mediaType: 'image/jpeg',
      originalFilename: 'a.jpg',
      captureDate: null,
      organizeDate: '2026-01-01T00:00:00.000Z',
      width: 100,
      height: 80,
      duration: null,
      tags: { people: [], places: [], events: ['trip'] },
    })
    expect(doc.decision).toBe('ACCEPTED')
    expect(doc.cloudStatus).toBe('PENDING')
    expect(doc.tags?.events).toEqual(['trip'])
    expect(doc.userId).toBe('oid-1')
  })

  it('rejects DUPLICATE writes', () => {
    expect(() => assertWritableDecision('DUPLICATE')).toThrow(/must not be written/)
  })
})

describe('DecisionRepository', () => {
  function createMockStore(): CosmosDecisionStore & {
    upserted: unknown[]
  } {
    const upserted: unknown[] = []
    return {
      upserted,
      readById: vi.fn(async () => null),
      queryByHashes: vi.fn(async (_userId: string, hashes: string[]) =>
        hashes.map((contentHash: string) => ({
          id: contentHash,
          userId: 'oid-1',
          contentHash,
          fileSize: 1,
          decision: 'REJECTED' as const,
          decidedAt: '2026-09-06T00:00:00.000Z',
        })),
      ),
      queryAcceptedSynced: vi.fn(async () => []),
      upsert: vi.fn(async (doc) => {
        upserted.push(doc)
        return doc
      }),
    }
  }

  it('uses getUserId as the partition key for lookups and upserts', async () => {
    const store = createMockStore()
    const repo = new DecisionRepository(store, () => 'oid-1')
    await repo.upsertRejected({ contentHash: 'h1', fileSize: 3 })
    await repo.lookupByHashes(['h1', 'h2'])

    expect(store.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'oid-1', contentHash: 'h1', fileSize: 3 }),
    )
    expect(store.queryByHashes).toHaveBeenCalledWith('oid-1', ['h1', 'h2'])
  })

  it('refuses batch upsert of DUPLICATE', async () => {
    const store = createMockStore()
    const repo = new DecisionRepository(store, () => 'oid-1')
    await expect(
      repo.upsertMany([{ decision: 'DUPLICATE', input: {} }]),
    ).rejects.toThrow(/must not be written/)
    expect(store.upsert).not.toHaveBeenCalled()
  })

  it('updateCloudSync patches status on an existing doc', async () => {
    const store = createMockStore()
    const repo = new DecisionRepository(store, () => 'oid-1')
    await repo.upsertRejected({ contentHash: 'h1', fileSize: 3 })
    store.readById = vi.fn(async () => ({
      id: 'h1',
      userId: 'oid-1',
      contentHash: 'h1',
      fileSize: 3,
      decision: 'ACCEPTED' as const,
      decidedAt: '2026-09-06T00:00:00.000Z',
      cloudStatus: 'PENDING' as const,
    }))
    const updated = await repo.updateCloudSync('h1', {
      cloudStatus: 'SYNCED',
      cloudObjectId: 'oid-1/h1',
    })
    expect(updated.cloudStatus).toBe('SYNCED')
    expect(updated.cloudObjectId).toBe('oid-1/h1')
  })
})

describe('cosmosConfig', () => {
  it('defaults database/container names', () => {
    const previous = process.env.YAADEIN_COSMOS_ENDPOINT
    process.env.YAADEIN_COSMOS_ENDPOINT = 'https://example.documents.azure.com:443/'
    try {
      const config = getCosmosPublicConfig()
      expect(config.databaseId).toBe('yaadein')
      expect(config.containerId).toBe('media')
      expect(config.scope).toContain('cosmos.azure.com')
    } finally {
      process.env.YAADEIN_COSMOS_ENDPOINT = previous
    }
  })

  it('assertCosmosConfig requires endpoint', () => {
    expect(() =>
      assertCosmosConfig({
        endpoint: '',
        databaseId: 'yaadein',
        containerId: 'media',
        scope: 'https://cosmos.azure.com/user_impersonation',
      }),
    ).toThrow(/endpoint/)
  })
})
