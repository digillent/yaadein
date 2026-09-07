import { app, ipcMain } from 'electron'
import { getAuthService } from '../auth/getAuthService'
import { createDecisionRepository } from '../cosmos'
import { createBlobUploadStore } from '../blob'
import { inspectMediaFile } from '../media/inspectMedia'
import { acceptUnknownMedia, rejectUnknownMedia, buildMediaPreview, acceptRejectedMedia } from '../review'
import type { MediaPreview, ReviewAcceptResult, ReviewRejectResult } from '../../shared/reviewTypes'

const CHANNELS = {
  preview: 'review:preview',
  accept: 'review:accept',
  reject: 'review:reject',
  acceptRejected: 'review:acceptRejected',
} as const

export function registerReviewIpc(): void {
  ipcMain.handle(CHANNELS.preview, async (_event, sourcePath: unknown): Promise<MediaPreview> => {
    if (typeof sourcePath !== 'string' || !sourcePath.trim()) {
      throw new Error('sourcePath is required')
    }
    return buildMediaPreview(sourcePath)
  })

  ipcMain.handle(
    CHANNELS.accept,
    async (
      _event,
      payload: { sourcePath?: unknown; workingRoot?: unknown; captureDateIso?: unknown },
    ): Promise<ReviewAcceptResult> => {
      const auth = await getAuthService(app.getPath('userData'))
      if (!auth.getSession().signedIn) {
        throw new Error('Sign in required to accept media.')
      }
      if (typeof payload?.sourcePath !== 'string' || !payload.sourcePath.trim()) {
        throw new Error('sourcePath is required')
      }
      if (typeof payload?.workingRoot !== 'string' || !payload.workingRoot.trim()) {
        throw new Error('workingRoot is required')
      }

      const inspection = await inspectMediaFile(payload.sourcePath, {
        userOverrideDate:
          typeof payload.captureDateIso === 'string' ? new Date(payload.captureDateIso) : undefined,
      })

      return acceptUnknownMedia({
        inspection,
        userId: auth.requireUserId(),
        workingRoot: payload.workingRoot,
        decisions: createDecisionRepository(auth),
        blobs: createBlobUploadStore(auth),
      })
    },
  )

  ipcMain.handle(
    CHANNELS.reject,
    async (
      _event,
      payload: { sourcePath?: unknown; workingRoot?: unknown; captureDateIso?: unknown },
    ): Promise<ReviewRejectResult> => {
      const auth = await getAuthService(app.getPath('userData'))
      if (!auth.getSession().signedIn) {
        throw new Error('Sign in required to reject media.')
      }
      if (typeof payload?.sourcePath !== 'string' || !payload.sourcePath.trim()) {
        throw new Error('sourcePath is required')
      }
      if (typeof payload?.workingRoot !== 'string' || !payload.workingRoot.trim()) {
        throw new Error('workingRoot is required')
      }

      const inspection = await inspectMediaFile(payload.sourcePath, {
        userOverrideDate:
          typeof payload.captureDateIso === 'string' ? new Date(payload.captureDateIso) : undefined,
      })

      return rejectUnknownMedia({
        inspection,
        workingRoot: payload.workingRoot,
        decisions: createDecisionRepository(auth),
      })
    },
  )

  ipcMain.handle(
    CHANNELS.acceptRejected,
    async (
      _event,
      payload: { sourcePath?: unknown; workingRoot?: unknown; captureDateIso?: unknown },
    ): Promise<ReviewAcceptResult> => {
      const auth = await getAuthService(app.getPath('userData'))
      if (!auth.getSession().signedIn) {
        throw new Error('Sign in required to accept rejected media.')
      }
      if (typeof payload?.sourcePath !== 'string' || !payload.sourcePath.trim()) {
        throw new Error('sourcePath is required')
      }
      if (typeof payload?.workingRoot !== 'string' || !payload.workingRoot.trim()) {
        throw new Error('workingRoot is required')
      }

      const inspection = await inspectMediaFile(payload.sourcePath, {
        userOverrideDate:
          typeof payload.captureDateIso === 'string' ? new Date(payload.captureDateIso) : undefined,
      })

      return acceptRejectedMedia({
        inspection,
        userId: auth.requireUserId(),
        workingRoot: payload.workingRoot,
        decisions: createDecisionRepository(auth),
        blobs: createBlobUploadStore(auth),
      })
    },
  )
}

export { CHANNELS as reviewChannels }
