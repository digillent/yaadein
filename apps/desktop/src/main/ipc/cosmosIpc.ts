import { app, ipcMain } from 'electron'
import { createHash } from 'node:crypto'
import { getAuthService } from '../auth/getAuthService'
import { createDecisionRepository } from '../cosmos'
import type { CosmosHarnessResult } from '../../shared/decisionTypes'

const CHANNELS = {
  harnessRoundTrip: 'cosmos:harnessRoundTrip',
} as const

export function registerCosmosIpc(): void {
  ipcMain.handle(CHANNELS.harnessRoundTrip, async (): Promise<CosmosHarnessResult> => {
    const auth = await getAuthService(app.getPath('userData'))
    const session = auth.getSession()
    if (!session.signedIn) {
      throw new Error('Sign in before running the Cosmos harness.')
    }

    const repo = createDecisionRepository(auth)
    const userId = auth.requireUserId()
    const stamp = new Date().toISOString()
    const contentHash = createHash('sha256').update(`yaadein-m5-harness:${userId}:${stamp}`).digest('hex')

    const upserted = await repo.upsertRejected({
      contentHash,
      fileSize: 42,
      decidedAt: stamp,
    })

    const found = await repo.lookupByHashes([contentHash])
    return {
      userId,
      upserted,
      lookedUp: found[0] ?? null,
    }
  })
}

export { CHANNELS as cosmosChannels }
