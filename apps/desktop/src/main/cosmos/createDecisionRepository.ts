import type { AccessToken, TokenCredential } from '@azure/core-auth'
import { CosmosClient } from '@azure/cosmos'
import type { AuthService } from '../auth/authService'
import { assertCosmosConfig, getCosmosPublicConfig, type CosmosPublicConfig } from './cosmosConfig'
import { createDecisionRepositoryFromClient, type DecisionRepository } from './decisionRepository'

class MsalCosmosCredential implements TokenCredential {
  constructor(
    private readonly auth: AuthService,
    private readonly cosmosScope: string,
  ) {}

  async getToken(): Promise<AccessToken | null> {
    const result = await this.auth.acquireTokenForScopes([this.cosmosScope])
    return {
      token: result.accessToken,
      expiresOnTimestamp: result.expiresOn?.getTime() ?? Date.now() + 60 * 60 * 1000,
    }
  }
}

export function createCosmosClient(
  auth: AuthService,
  config: CosmosPublicConfig = getCosmosPublicConfig(),
): CosmosClient {
  assertCosmosConfig(config)
  return new CosmosClient({
    endpoint: config.endpoint,
    aadCredentials: new MsalCosmosCredential(auth, config.scope),
  })
}

export function createDecisionRepository(
  auth: AuthService,
  config: CosmosPublicConfig = getCosmosPublicConfig(),
): DecisionRepository {
  const client = createCosmosClient(auth, config)
  return createDecisionRepositoryFromClient(
    client,
    config.databaseId,
    config.containerId,
    () => auth.requireUserId(),
  )
}
