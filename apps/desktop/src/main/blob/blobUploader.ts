import type { AccessToken, TokenCredential } from '@azure/core-auth'
import { BlobServiceClient, type BlockBlobClient } from '@azure/storage-blob'
import type { AuthService } from '../auth/authService'
import {
  assertBlobConfig,
  buildCloudObjectId,
  getBlobPublicConfig,
  type BlobPublicConfig,
} from './blobConfig'

class MsalStorageCredential implements TokenCredential {
  constructor(
    private readonly auth: AuthService,
    private readonly storageScope: string,
  ) {}

  async getToken(): Promise<AccessToken | null> {
    const result = await this.auth.acquireTokenForScopes([this.storageScope])
    return {
      token: result.accessToken,
      expiresOnTimestamp: result.expiresOn?.getTime() ?? Date.now() + 60 * 60 * 1000,
    }
  }
}

export type BlobMediaStore = {
  uploadFile(args: {
    cloudObjectId: string
    localPath: string
    contentType?: string
    /** Loaded byte count from Azure transfer progress. */
    onProgress?: (loadedBytes: number) => void
  }): Promise<{ cloudObjectId: string; blobUrl: string }>
  downloadFile(args: {
    cloudObjectId: string
    localPath: string
  }): Promise<{ cloudObjectId: string }>
  /** Delete blob by cloudObjectId. No-ops when the blob is already missing (404). */
  deleteFile(args: { cloudObjectId: string }): Promise<void>
}

/** @deprecated Prefer BlobMediaStore — kept for existing call sites. */
export type BlobUploadStore = BlobMediaStore

function isBlobNotFound(error: unknown): boolean {
  const status =
    typeof error === 'object' && error !== null && 'statusCode' in error
      ? Number((error as { statusCode?: unknown }).statusCode)
      : NaN
  return status === 404
}

export function createBlobUploadStore(
  auth: AuthService,
  config: BlobPublicConfig = getBlobPublicConfig(),
): BlobMediaStore {
  assertBlobConfig(config)
  const service = new BlobServiceClient(
    config.accountUrl,
    new MsalStorageCredential(auth, config.scope),
  )
  const container = service.getContainerClient(config.containerName)

  return {
    async uploadFile({ cloudObjectId, localPath, contentType, onProgress }) {
      const blockBlob: BlockBlobClient = container.getBlockBlobClient(cloudObjectId)
      await blockBlob.uploadFile(localPath, {
        blobHTTPHeaders: contentType ? { blobContentType: contentType } : undefined,
        onProgress: onProgress
          ? (event) => {
              onProgress(event.loadedBytes)
            }
          : undefined,
      })
      return {
        cloudObjectId,
        blobUrl: blockBlob.url,
      }
    },

    async downloadFile({ cloudObjectId, localPath }) {
      const blockBlob: BlockBlobClient = container.getBlockBlobClient(cloudObjectId)
      await blockBlob.downloadToFile(localPath)
      return { cloudObjectId }
    },

    async deleteFile({ cloudObjectId }) {
      const blockBlob: BlockBlobClient = container.getBlockBlobClient(cloudObjectId)
      try {
        await blockBlob.delete()
      } catch (error) {
        if (isBlobNotFound(error)) {
          return
        }
        throw error
      }
    },
  }
}

export function createBlobUploadStoreForUser(
  auth: AuthService,
  config?: BlobPublicConfig,
): {
  store: BlobMediaStore
  objectIdFor(contentHash: string): string
} {
  const resolved = config ?? getBlobPublicConfig()
  return {
    store: createBlobUploadStore(auth, resolved),
    objectIdFor: (contentHash: string) => buildCloudObjectId(auth.requireUserId(), contentHash),
  }
}
