import { app, ipcMain } from 'electron'
import { getAuthService } from '../auth/getAuthService'
import { createDecisionRepository } from '../cosmos'
import { createBlobUploadStore } from '../blob'
import { listCherishMedia } from '../cherish/listCherishMedia'
import { rejectPreserveMedia } from '../review/rejectPreserve'
import { inspectMediaFile } from '../media/inspectMedia'
import type { CherishListResult } from '../../shared/cherishTypes'
import type { ReviewRejectResult } from '../../shared/reviewTypes'

const CHANNELS = {
  list: 'cherish:list',
  reject: 'cherish:reject',
} as const

export function registerCherishIpc(): void {
  ipcMain.handle(
    CHANNELS.list,
    async (_event, payload: { workingRoot?: unknown }): Promise<CherishListResult> => {
      if (typeof payload?.workingRoot !== 'string' || !payload.workingRoot.trim()) {
        throw new Error('workingRoot is required')
      }

      const auth = await getAuthService(app.getPath('userData'))
      if (!auth.getSession().signedIn) {
        return listCherishMedia(payload.workingRoot, { decisions: null })
      }

      const decisions = createDecisionRepository(auth)
      return listCherishMedia(payload.workingRoot, {
        decisions: {
          listAcceptedSynced: () => decisions.listAcceptedSynced(),
        },
      })
    },
  )

  ipcMain.handle(
    CHANNELS.reject,
    async (
      _event,
      payload: { workingRoot?: unknown; sourcePath?: unknown; captureDateIso?: unknown },
    ): Promise<ReviewRejectResult> => {
      const auth = await getAuthService(app.getPath('userData'))
      if (!auth.getSession().signedIn) {
        throw new Error('Sign in required to reject preserved media.')
      }
      if (typeof payload?.workingRoot !== 'string' || !payload.workingRoot.trim()) {
        throw new Error('workingRoot is required')
      }
      if (typeof payload?.sourcePath !== 'string' || !payload.sourcePath.trim()) {
        throw new Error('sourcePath is required')
      }

      const inspection = await inspectMediaFile(payload.sourcePath, {
        userOverrideDate:
          typeof payload.captureDateIso === 'string' ? new Date(payload.captureDateIso) : undefined,
      })

      return rejectPreserveMedia({
        inspection,
        workingRoot: payload.workingRoot,
        decisions: createDecisionRepository(auth),
        blobs: createBlobUploadStore(auth),
      })
    },
  )
}

export { CHANNELS as cherishChannels }
