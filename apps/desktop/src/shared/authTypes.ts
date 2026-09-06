export type AuthSession = {
  signedIn: boolean
  accountName: string | null
  username: string | null
  homeAccountId: string | null
}

export type GraphMeProfile = {
  id?: string
  displayName?: string
  userPrincipalName?: string
  mail?: string
}
