import { app, ipcMain } from 'electron'
import { getAuthService } from '../auth/getAuthService'
import { createDecisionRepository } from '../cosmos'
import { acceptAndUploadMedia, createBlobUploadStore } from '../blob'
import { inspectMediaFile } from '../media/inspectMedia'
import type { AcceptUploadHarnessResult } from '../../shared/decisionTypes'

const CHANNELS = {
  acceptAndUpload: 'blob:acceptAndUpload',
} as const

export function registerBlobIpc(): void {
  ipcMain.handle(
    CHANNELS.acceptAndUpload,
    async (
      _event,
      payload: { sourcePath: string; captureDateIso?: string },
    ): Promise<AcceptUploadHarnessResult> => {
      const auth = await getAuthService(app.getPath('userData'))
      if (!auth.getSession().signedIn) {
        throw new Error('Sign in before accepting/uploading to Blob.')
      }
      if (!payload?.sourcePath?.trim()) {
        throw new Error('sourcePath is required.')
      }

      const inspection = await inspectMediaFile(payload.sourcePath, {
        userOverrideDate: payload.captureDateIso ? new Date(payload.captureDateIso) : undefined,
      })

      const decisions = createDecisionRepository(auth)
      const blobs = createBlobUploadStore(auth)
      const userId = auth.requireUserId()

      try {
        const result = await acceptAndUploadMedia({
          inspection,
          userId,
          decisions,
          blobs,
        })
        return { userId, ...result }
      } catch (error) {
        const partial = (
          error as { acceptUploadResult?: AcceptUploadHarnessResult }
        ).acceptUploadResult
        if (partial) {
          throw Object.assign(error instanceof Error ? error : new Error(String(error)), {
            acceptUploadResult: { userId, ...partial },
          })
        }
        throw error
      }
    },
  )
}

export { CHANNELS as blobChannels }
