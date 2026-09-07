/**
 * Public Yaadein config keys (Entra IDs + Cosms/Blob endpoints — never account keys).
 * Filled from apps/desktop/.env at build time via Vite envPrefix, or process.env at runtime.
 */
export const YAADEIN_PUBLIC_ENV_KEYS = [
  'YAADEIN_ENTRA_CLIENT_ID',
  'YAADEIN_ENTRA_TENANT_ID',
  'YAADEIN_COSMOS_ENDPOINT',
  'YAADEIN_COSMOS_DATABASE',
  'YAADEIN_COSMOS_CONTAINER',
  'YAADEIN_COSMOS_SCOPE',
  'YAADEIN_BLOB_ACCOUNT_URL',
  'YAADEIN_BLOB_CONTAINER',
  'YAADEIN_BLOB_SCOPE',
] as const

export type YaadeinPublicEnvKey = (typeof YAADEIN_PUBLIC_ENV_KEYS)[number]

/**
 * Prefer runtime process.env (tests / overrides), then build-time import.meta.env from .env.
 */
export function readPublicEnv(key: YaadeinPublicEnvKey): string {
  const runtime = process.env[key]
  if (runtime !== undefined && runtime.trim() !== '') {
    return runtime.trim()
  }
  const embedded = import.meta.env[key]
  return typeof embedded === 'string' ? embedded.trim() : ''
}
