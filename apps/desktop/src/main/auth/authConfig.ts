import { COSMOS_DEFAULT_SCOPE } from '../cosmos/cosmosConfig'
import { STORAGE_DEFAULT_SCOPE } from '../blob/blobConfig'
import { readPublicEnv } from './readPublicEnv'

export type AuthPublicConfig = {
  clientId: string
  tenantId: string
  /** Single-tenant authority for this Azure subscription directory. */
  authority: string
  /**
   * Scopes for interactive sign-in. Cosms is primary;
   * Graph and Storage use separate token requests when needed.
   */
  scopes: string[]
  graphScopes: string[]
  cosmosScope: string
  storageScope: string
  redirectUri: string
}

/**
 * Non-secret Entra public-client settings (never account keys / client secrets).
 * Dev: apps/desktop/.env. Packaged: values embedded at `pnpm dist` / build time.
 */
export function getAuthPublicConfig(): AuthPublicConfig {
  const clientId = readPublicEnv('YAADEIN_ENTRA_CLIENT_ID')
  const tenantId = readPublicEnv('YAADEIN_ENTRA_TENANT_ID')
  const cosmosScope = readPublicEnv('YAADEIN_COSMOS_SCOPE') || COSMOS_DEFAULT_SCOPE
  const storageScope = readPublicEnv('YAADEIN_BLOB_SCOPE') || STORAGE_DEFAULT_SCOPE

  return {
    clientId,
    tenantId,
    authority: tenantId
      ? `https://login.microsoftonline.com/${tenantId}`
      : 'https://login.microsoftonline.com/common',
    scopes: [cosmosScope],
    graphScopes: ['User.Read'],
    cosmosScope,
    storageScope,
    redirectUri: 'http://localhost',
  }
}

export function assertAuthConfig(config: AuthPublicConfig): void {
  if (!config.clientId.trim() || !config.tenantId.trim()) {
    throw new Error(
      'Entra clientId and tenantId are required. Copy apps/desktop/.env.example to .env and fill YAADEIN_ENTRA_CLIENT_ID / YAADEIN_ENTRA_TENANT_ID.',
    )
  }
}
