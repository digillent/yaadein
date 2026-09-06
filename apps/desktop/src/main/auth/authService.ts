import {
  PublicClientApplication,
  type AccountInfo,
  type AuthenticationResult,
  type ICachePlugin,
  type TokenCacheContext,
} from '@azure/msal-node'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { shell } from 'electron'
import type { AuthSession, GraphMeProfile } from '../../shared/authTypes'
import { assertAuthConfig, getAuthPublicConfig, type AuthPublicConfig } from './authConfig'
import { fetchJsonWithBearer } from './apiClient'

export type { AuthSession, GraphMeProfile }

const GRAPH_ME_URL = 'https://graph.microsoft.com/v1.0/me'

function createFileCachePlugin(cachePath: string): ICachePlugin {
  return {
    beforeCacheAccess: async (context: TokenCacheContext): Promise<void> => {
      if (existsSync(cachePath)) {
        context.tokenCache.deserialize(readFileSync(cachePath, 'utf8'))
      }
    },
    afterCacheAccess: async (context: TokenCacheContext): Promise<void> => {
      if (context.cacheHasChanged) {
        mkdirSync(dirname(cachePath), { recursive: true })
        writeFileSync(cachePath, context.tokenCache.serialize(), 'utf8')
      }
    },
  }
}

function toSession(account: AccountInfo | null): AuthSession {
  if (!account) {
    return {
      signedIn: false,
      accountName: null,
      username: null,
      homeAccountId: null,
      userId: null,
    }
  }
  return {
    signedIn: true,
    accountName: account.name ?? null,
    username: account.username ?? null,
    homeAccountId: account.homeAccountId,
    userId: account.localAccountId,
  }
}

export class AuthService {
  private readonly config: AuthPublicConfig
  private readonly pca: PublicClientApplication
  private account: AccountInfo | null = null

  constructor(cachePath: string, config: AuthPublicConfig = getAuthPublicConfig()) {
    assertAuthConfig(config)
    this.config = config
    this.pca = new PublicClientApplication({
      auth: {
        clientId: config.clientId,
        authority: config.authority,
      },
      cache: {
        cachePlugin: createFileCachePlugin(cachePath),
      },
    })
  }

  async initialize(): Promise<void> {
    const accounts = await this.pca.getTokenCache().getAllAccounts()
    this.account = accounts[0] ?? null
  }

  getSession(): AuthSession {
    return toSession(this.account)
  }

  /** Entra object id used as Cosms partition key `/userId`. */
  requireUserId(): string {
    const userId = this.account?.localAccountId?.trim()
    if (!userId) {
      throw new Error('Sign in required: Cosms partition userId (Entra oid) is unavailable.')
    }
    return userId
  }

  async signInInteractive(): Promise<AuthSession> {
    const result = await this.pca.acquireTokenInteractive({
      scopes: this.config.scopes,
      openBrowser: async (url) => {
        await shell.openExternal(url)
      },
      successTemplate:
        '<html><body><h2>Yaadein sign-in complete</h2><p>You can close this window and return to the app.</p></body></html>',
      errorTemplate:
        '<html><body><h2>Yaadein sign-in failed</h2><p>{{error}}</p></body></html>',
    })
    this.account = result.account
    return this.getSession()
  }

  async signOut(): Promise<AuthSession> {
    if (this.account) {
      await this.pca.getTokenCache().removeAccount(this.account)
      this.account = null
    }
    return this.getSession()
  }

  async getAccessToken(): Promise<string> {
    const result = await this.acquireTokenForScopes(this.config.scopes)
    return result.accessToken
  }

  async acquireTokenForScopes(scopes: string[]): Promise<AuthenticationResult> {
    if (this.account) {
      try {
        return await this.pca.acquireTokenSilent({
          account: this.account,
          scopes,
        })
      } catch {
        // Fall through to interactive.
      }
    }

    const interactive = await this.pca.acquireTokenInteractive({
      scopes,
      openBrowser: async (url) => {
        await shell.openExternal(url)
      },
    })
    this.account = interactive.account
    return interactive
  }

  /** Calls Microsoft Graph `/me` with a Graph-scoped access token (M4 harness). */
  async fetchMeProfile(): Promise<GraphMeProfile> {
    const result = await this.acquireTokenForScopes(this.config.graphScopes)
    return fetchJsonWithBearer<GraphMeProfile>(GRAPH_ME_URL, result.accessToken)
  }
}
