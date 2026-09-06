export type AuthSession = {
  signedIn: boolean
  accountName: string | null
  username: string | null
  homeAccountId: string | null
  /** Entra oid — Cosms partition key `/userId`. */
  userId: string | null
}

export type GraphMeProfile = {
  id?: string
  displayName?: string
  userPrincipalName?: string
  mail?: string
}
