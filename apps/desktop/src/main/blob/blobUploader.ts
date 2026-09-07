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

export type BlobUploadStore = {
  uploadFile(args: {
    cloudObjectId: string
    localPath: string
    contentType?: string
  }): Promise<{ cloudObjectId: string; blobUrl: string }>
}

export function createBlobUploadStore(
  auth: AuthService,
  config: BlobPublicConfig = getBlobPublicConfig(),
): BlobUploadStore {
  assertBlobConfig(config)
  const service = new BlobServiceClient(
    config.accountUrl,
    new MsalStorageCredential(auth, config.scope),
  )
  const container = service.getContainerClient(config.containerName)

  return {
    async uploadFile({ cloudObjectId, localPath, contentType }) {
      const blockBlob: BlockBlobClient = container.getBlockBlobClient(cloudObjectId)
      await blockBlob.uploadFile(localPath, {
        blobHTTPHeaders: contentType ? { blobContentType: contentType } : undefined,
      })
      return {
        cloudObjectId,
        blobUrl: blockBlob.url,
      }
    },
  }
}

export function createBlobUploadStoreForUser(
  auth: AuthService,
  config?: BlobPublicConfig,
): {
  store: BlobUploadStore
  objectIdFor(contentHash: string): string
} {
  const resolved = config ?? getBlobPublicConfig()
  return {
    store: createBlobUploadStore(auth, resolved),
    objectIdFor: (contentHash: string) => buildCloudObjectId(auth.requireUserId(), contentHash),
  }
}
