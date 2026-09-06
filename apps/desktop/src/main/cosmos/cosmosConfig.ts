export type CosmosPublicConfig = {
  endpoint: string
  databaseId: string
  containerId: string
  /** Delegated Cosms resource scope (Entra user_impersonation). */
  scope: string
}

export const COSMOS_DEFAULT_SCOPE = 'https://cosmos.azure.com/user_impersonation'

/**
 * Non-secret Cosms endpoints/names from env (never account keys).
 * Set YAADEIN_COSMOS_ENDPOINT in apps/desktop/.env
 */
export function getCosmosPublicConfig(): CosmosPublicConfig {
  return {
    endpoint: process.env.YAADEIN_COSMOS_ENDPOINT?.trim() ?? '',
    databaseId: process.env.YAADEIN_COSMOS_DATABASE?.trim() || 'yaadein',
    containerId: process.env.YAADEIN_COSMOS_CONTAINER?.trim() || 'media',
    scope: process.env.YAADEIN_COSMOS_SCOPE?.trim() || COSMOS_DEFAULT_SCOPE,
  }
}

export function assertCosmosConfig(config: CosmosPublicConfig): void {
  if (!config.endpoint.trim()) {
    throw new Error(
      'Cosmos endpoint is required. Set YAADEIN_COSMOS_ENDPOINT in apps/desktop/.env (account endpoint URL only — no keys).',
    )
  }
}
