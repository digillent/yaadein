export type AuthPublicConfig = {
  clientId: string
  tenantId: string
  /** Single-tenant authority for this Azure subscription directory. */
  authority: string
  /** Delegated scopes requested at sign-in (Graph `me` for Milestone 4 stub). */
  scopes: string[]
  redirectUri: string
}

/**
 * Non-secret Entra public-client settings from env (never commit real values).
 * Set YAADEIN_ENTRA_CLIENT_ID and YAADEIN_ENTRA_TENANT_ID in apps/desktop/.env
 */
export function getAuthPublicConfig(): AuthPublicConfig {
  const clientId = process.env.YAADEIN_ENTRA_CLIENT_ID?.trim() ?? ''
  const tenantId = process.env.YAADEIN_ENTRA_TENANT_ID?.trim() ?? ''

  return {
    clientId,
    tenantId,
    authority: tenantId
      ? `https://login.microsoftonline.com/${tenantId}`
      : 'https://login.microsoftonline.com/common',
    scopes: ['User.Read'],
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
