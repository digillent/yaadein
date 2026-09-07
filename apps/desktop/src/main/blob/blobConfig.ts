import { readPublicEnv } from '../auth/readPublicEnv'

export type BlobPublicConfig = {
  accountUrl: string
  containerName: string
  /** Delegated Azure Storage scope (Entra user_impersonation). */
  scope: string
}

export const STORAGE_DEFAULT_SCOPE = 'https://storage.azure.com/user_impersonation'

/**
 * Non-secret Blob settings (never account keys).
 * Dev: apps/desktop/.env. Packaged: embedded at build time.
 */
export function getBlobPublicConfig(): BlobPublicConfig {
  return {
    accountUrl: readPublicEnv('YAADEIN_BLOB_ACCOUNT_URL').replace(/\/$/, ''),
    containerName: readPublicEnv('YAADEIN_BLOB_CONTAINER') || 'media',
    scope: readPublicEnv('YAADEIN_BLOB_SCOPE') || STORAGE_DEFAULT_SCOPE,
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
