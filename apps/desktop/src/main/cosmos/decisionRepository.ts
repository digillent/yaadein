import type { Container, CosmosClient } from '@azure/cosmos'
import type {
  AcceptedDecisionInput,
  MediaDecisionDocument,
  RejectedDecisionInput,
} from '../../shared/decisionTypes'
import { buildAcceptedDocument, buildRejectedDocument } from './decisionDocuments'

/** Minimal Cosms surface used by the repository (mockable in tests). */
export type CosmosDecisionStore = {
  readById(id: string, userId: string): Promise<MediaDecisionDocument | null>
  queryByHashes(userId: string, hashes: string[]): Promise<MediaDecisionDocument[]>
  upsert(doc: MediaDecisionDocument): Promise<MediaDecisionDocument>
}

export function createCosmosDecisionStore(container: Container): CosmosDecisionStore {
  return {
    async readById(id, userId) {
      try {
        const { resource } = await container.item(id, userId).read<MediaDecisionDocument>()
        return resource ?? null
      } catch (error) {
        if (isNotFound(error)) {
          return null
        }
        throw error
      }
    },

    async queryByHashes(userId, hashes) {
      if (hashes.length === 0) {
        return []
      }
      const { resources } = await container.items
        .query<MediaDecisionDocument>(
          {
            query: 'SELECT * FROM c WHERE ARRAY_CONTAINS(@hashes, c.contentHash)',
            parameters: [{ name: '@hashes', value: hashes }],
          },
          { partitionKey: userId },
        )
        .fetchAll()
      return resources
    },

    async upsert(doc) {
      const { resource } = await container.items.upsert<MediaDecisionDocument>(doc)
      if (!resource) {
        throw new Error('Cosmos upsert returned no resource.')
      }
      return resource
    },
  }
}

export class DecisionRepository {
  constructor(
    private readonly store: CosmosDecisionStore,
    private readonly getUserId: () => string,
  ) {}

  async lookupByHashes(hashes: string[]): Promise<MediaDecisionDocument[]> {
    const userId = this.getUserId()
    const unique = [...new Set(hashes.filter((h) => h.trim()))]
    if (unique.length === 0) {
      return []
    }
    // Prefer batch query sized to the candidate set (ARCHITECTURE: batch Cosms ops).
    return this.store.queryByHashes(userId, unique)
  }

  async upsertAccepted(input: AcceptedDecisionInput): Promise<MediaDecisionDocument> {
    const doc = buildAcceptedDocument(this.getUserId(), input)
    return this.store.upsert(doc)
  }

  async upsertRejected(input: RejectedDecisionInput): Promise<MediaDecisionDocument> {
    const doc = buildRejectedDocument(this.getUserId(), input)
    return this.store.upsert(doc)
  }

  async upsertMany(
    inputs: Array<
      | { decision: 'ACCEPTED'; input: AcceptedDecisionInput }
      | { decision: 'REJECTED'; input: RejectedDecisionInput }
      | { decision: 'DUPLICATE'; input: unknown }
    >,
  ): Promise<MediaDecisionDocument[]> {
    const results: MediaDecisionDocument[] = []
    for (const item of inputs) {
      if (item.decision === 'DUPLICATE') {
        throw new Error('DUPLICATE must not be written to Cosmos; keep duplicates local only.')
      }
      if (item.decision === 'ACCEPTED') {
        results.push(await this.upsertAccepted(item.input))
      } else {
        results.push(await this.upsertRejected(item.input))
      }
    }
    return results
  }
}

export function createDecisionRepositoryFromClient(
  client: CosmosClient,
  databaseId: string,
  containerId: string,
  getUserId: () => string,
): DecisionRepository {
  const container = client.database(databaseId).container(containerId)
  return new DecisionRepository(createCosmosDecisionStore(container), getUserId)
}

function isNotFound(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: number }).code === 404
  )
}
