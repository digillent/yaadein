import { app, ipcMain } from 'electron'
import { getAuthService } from '../auth/getAuthService'
import { createDecisionRepository } from '../cosmos'
import { scanAndClassify } from '../scan'
import type { ScanClassifyRequest, ScanClassifyResult, ScanProgress } from '../../shared/scanTypes'

const CHANNELS = {
  run: 'scan:run',
  progress: 'scan:progress',
} as const

export function registerScanIpc(): void {
  ipcMain.handle(
    CHANNELS.run,
    async (event, payload: ScanClassifyRequest): Promise<ScanClassifyResult> => {
      const auth = await getAuthService(app.getPath('userData'))
      const decisions = createDecisionRepository(auth)

      return scanAndClassify(
        {
          scanRoots: payload?.scanRoots ?? [],
          workingRoot: payload?.workingRoot ?? '',
        },
        {
          requireSignedIn: () => {
            if (!auth.getSession().signedIn) {
              throw new Error('Sign in required to scan and classify against Cosmos.')
            }
          },
          decisions,
          onProgress: (progress: ScanProgress) => {
            event.sender.send(CHANNELS.progress, progress)
          },
        },
      )
    },
  )
}

export { CHANNELS as scanChannels }
