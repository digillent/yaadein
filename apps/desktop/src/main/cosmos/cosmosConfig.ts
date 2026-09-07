import { readPublicEnv } from '../auth/readPublicEnv'

export type CosmosPublicConfig = {
  endpoint: string
  databaseId: string
  containerId: string
  /** Delegated Cosms resource scope (Entra user_impersonation). */
  scope: string
}

export const COSMOS_DEFAULT_SCOPE = 'https://cosmos.azure.com/user_impersonation'

/**
 * Non-secret Cosms endpoints/names (never account keys).
 * Dev: apps/desktop/.env. Packaged: embedded at build time.
 */
export function getCosmosPublicConfig(): CosmosPublicConfig {
  return {
    endpoint: readPublicEnv('YAADEIN_COSMOS_ENDPOINT'),
    databaseId: readPublicEnv('YAADEIN_COSMOS_DATABASE') || 'yaadein',
    containerId: readPublicEnv('YAADEIN_COSMOS_CONTAINER') || 'media',
    scope: readPublicEnv('YAADEIN_COSMOS_SCOPE') || COSMOS_DEFAULT_SCOPE,
  }
}

export function assertCosmosConfig(config: CosmosPublicConfig): void {
  if (!config.endpoint.trim()) {
    throw new Error(
      'Cosmos endpoint is required. Set YAADEIN_COSMOS_ENDPOINT in apps/desktop/.env (account endpoint URL only — no keys).',
    )
  }
}
