import { app, ipcMain } from 'electron'
import { getAuthService } from '../auth/getAuthService'
import { createDecisionRepository } from '../cosmos'
import { createBlobUploadStore } from '../blob'
import { restorePreserveFromCloud } from '../restore'
import type { RestorePreserveResult, RestoreProgress } from '../../shared/restoreTypes'

const CHANNELS = {
  run: 'restore:run',
  progress: 'restore:progress',
} as const

export function registerRestoreIpc(): void {
  ipcMain.handle(
    CHANNELS.run,
    async (event, payload: { workingRoot?: unknown }): Promise<RestorePreserveResult> => {
      const auth = await getAuthService(app.getPath('userData'))
      if (!auth.getSession().signedIn) {
        throw new Error('Sign in required to restore from Blob.')
      }
      if (typeof payload?.workingRoot !== 'string' || !payload.workingRoot.trim()) {
        throw new Error('workingRoot is required')
      }

      const decisions = createDecisionRepository(auth)
      return restorePreserveFromCloud(payload.workingRoot, {
        decisions: {
          listAcceptedSynced: () => decisions.listAcceptedSynced(),
          requireUserId: () => auth.requireUserId(),
        },
        blobs: createBlobUploadStore(auth),
        onProgress: (progress: RestoreProgress) => {
          event.sender.send(CHANNELS.progress, progress)
        },
      })
    },
  )
}

export { CHANNELS as restoreChannels }
