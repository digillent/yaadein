import { app, ipcMain } from 'electron'
import { getAuthService } from '../auth/getAuthService'
import { createDecisionRepository } from '../cosmos'
import { createBlobUploadStore } from '../blob'
import { listCleanupFiles } from '../workingFolder/cleanupLocal'
import { resolveDuplicateComparePair } from '../duplicates/resolveOriginal'
import type { CleanupListResult } from '../../shared/cleanupTypes'
import type { DuplicateComparePair } from '../../shared/duplicateTypes'

const CHANNELS = {
  list: 'duplicates:list',
  resolve: 'duplicates:resolve',
} as const

export function registerDuplicatesIpc(): void {
  ipcMain.handle(
    CHANNELS.list,
    async (_event, payload: { workingRoot?: unknown }): Promise<CleanupListResult> => {
      if (typeof payload?.workingRoot !== 'string' || !payload.workingRoot.trim()) {
        throw new Error('workingRoot is required')
      }
      return listCleanupFiles(payload.workingRoot, 'duplicate')
    },
  )

  ipcMain.handle(
    CHANNELS.resolve,
    async (
      _event,
      payload: { workingRoot?: unknown; duplicatePath?: unknown },
    ): Promise<DuplicateComparePair> => {
      if (typeof payload?.workingRoot !== 'string' || !payload.workingRoot.trim()) {
        throw new Error('workingRoot is required')
      }
      if (typeof payload?.duplicatePath !== 'string' || !payload.duplicatePath.trim()) {
        throw new Error('duplicatePath is required')
      }

      const auth = await getAuthService(app.getPath('userData'))
      if (!auth.getSession().signedIn) {
        throw new Error('Sign in required to resolve Cosms ACCEPTED originals for compare.')
      }

      return resolveDuplicateComparePair(payload.workingRoot, payload.duplicatePath, {
        decisions: createDecisionRepository(auth),
        blobs: createBlobUploadStore(auth),
      })
    },
  )
}

export { CHANNELS as duplicatesChannels }
