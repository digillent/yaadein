export type BlobPublicConfig = {
  accountUrl: string
  containerName: string
  /** Delegated Azure Storage scope (Entra user_impersonation). */
  scope: string
}

export const STORAGE_DEFAULT_SCOPE = 'https://storage.azure.com/user_impersonation'

/**
 * Non-secret Blob settings from env (never account keys).
 * Set YAADEIN_BLOB_ACCOUNT_URL in apps/desktop/.env
 * Example: https://yaadeinstoragedev.blob.core.windows.net
 */
export function getBlobPublicConfig(): BlobPublicConfig {
  return {
    accountUrl: (process.env.YAADEIN_BLOB_ACCOUNT_URL?.trim() ?? '').replace(/\/$/, ''),
    containerName: process.env.YAADEIN_BLOB_CONTAINER?.trim() || 'media',
    scope: process.env.YAADEIN_BLOB_SCOPE?.trim() || STORAGE_DEFAULT_SCOPE,
  }
}

export function assertBlobConfig(config: BlobPublicConfig): void {
  if (!config.accountUrl.trim()) {
    throw new Error(
      'Blob account URL is required. Set YAADEIN_BLOB_ACCOUNT_URL in apps/desktop/.env (https://<account>.blob.core.windows.net — no keys).',
    )
  }
  if (!config.containerName.trim()) {
    throw new Error('YAADEIN_BLOB_CONTAINER is required.')
  }
}

/** Blob path / cloudObjectId: partition by user, identity by content hash. */
export function buildCloudObjectId(userId: string, contentHash: string): string {
  if (!userId.trim() || !contentHash.trim()) {
    throw new Error('userId and contentHash are required for blob object id.')
  }
  return `${userId}/${contentHash}`
}
