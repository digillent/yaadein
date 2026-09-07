/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly YAADEIN_ENTRA_CLIENT_ID?: string
  readonly YAADEIN_ENTRA_TENANT_ID?: string
  readonly YAADEIN_COSMOS_ENDPOINT?: string
  readonly YAADEIN_COSMOS_DATABASE?: string
  readonly YAADEIN_COSMOS_CONTAINER?: string
  readonly YAADEIN_COSMOS_SCOPE?: string
  readonly YAADEIN_BLOB_ACCOUNT_URL?: string
  readonly YAADEIN_BLOB_CONTAINER?: string
  readonly YAADEIN_BLOB_SCOPE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
