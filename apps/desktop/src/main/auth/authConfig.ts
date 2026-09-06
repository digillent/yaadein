import { COSMOS_DEFAULT_SCOPE } from '../cosmos/cosmosConfig'

export type AuthPublicConfig = {
  clientId: string
  tenantId: string
  /** Single-tenant authority for this Azure subscription directory. */
  authority: string
  /**
   * Scopes for interactive sign-in. Cosms is primary for M5+;
   * Graph User.Read stays available for the /me harness via a separate token request.
   */
  scopes: string[]
  graphScopes: string[]
  cosmosScope: string
  redirectUri: string
}

/**
 * Non-secret Entra public-client settings from env (never commit real values).
 * Set YAADEIN_ENTRA_CLIENT_ID and YAADEIN_ENTRA_TENANT_ID in apps/desktop/.env
 */
export function getAuthPublicConfig(): AuthPublicConfig {
  const clientId = process.env.YAADEIN_ENTRA_CLIENT_ID?.trim() ?? ''
  const tenantId = process.env.YAADEIN_ENTRA_TENANT_ID?.trim() ?? ''
  const cosmosScope = process.env.YAADEIN_COSMOS_SCOPE?.trim() || COSMOS_DEFAULT_SCOPE

  return {
    clientId,
    tenantId,
    authority: tenantId
      ? `https://login.microsoftonline.com/${tenantId}`
      : 'https://login.microsoftonline.com/common',
    scopes: [cosmosScope],
    graphScopes: ['User.Read'],
    cosmosScope,
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
