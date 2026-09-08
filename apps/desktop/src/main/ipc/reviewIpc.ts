import { app, ipcMain } from 'electron'
import { dirname } from 'node:path'
import { getAuthService } from '../auth/getAuthService'
import { createDecisionRepository } from '../cosmos'
import { createBlobUploadStore } from '../blob'
import { inspectMediaFile } from '../media/inspectMedia'
import { acceptUnknownMedia, rejectUnknownMedia, buildMediaPreview, acceptRejectedMedia } from '../review'
import { loadPersistedSettings } from '../settings/persistedSettings'
import { pruneEmptyAncestors } from '../workingFolder/pruneEmptyDirs'
import type { MediaPreview, ReviewAcceptProgress, ReviewAcceptResult, ReviewRejectResult } from '../../shared/reviewTypes'

const CHANNELS = {
  preview: 'review:preview',
  accept: 'review:accept',
  acceptProgress: 'review:accept-progress',
  reject: 'review:reject',
  acceptRejected: 'review:acceptRejected',
} as const

async function pruneScanFolderAfterMove(sourcePath: string): Promise<void> {
  const settings = await loadPersistedSettings(app.getPath('userData'))
  if (!settings.scanRoot.trim()) {
    return
  }
  await pruneEmptyAncestors(dirname(sourcePath), [settings.scanRoot])
}

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
      event,
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

      const onProgress = (progress: ReviewAcceptProgress): void => {
        event.sender.send(CHANNELS.acceptProgress, progress)
      }

      const result = await acceptUnknownMedia({
        inspection,
        userId: auth.requireUserId(),
        workingRoot: payload.workingRoot,
        decisions: createDecisionRepository(auth),
        blobs: createBlobUploadStore(auth),
        onProgress,
      })
      await pruneScanFolderAfterMove(payload.sourcePath)
      return result
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

      const result = await rejectUnknownMedia({
        inspection,
        workingRoot: payload.workingRoot,
        decisions: createDecisionRepository(auth),
      })
      await pruneScanFolderAfterMove(payload.sourcePath)
      return result
    },
  )

  ipcMain.handle(
    CHANNELS.acceptRejected,
    async (
      event,
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
        onProgress: (progress) => {
          event.sender.send(CHANNELS.acceptProgress, progress)
        },
      })
    },
  )
}

export { CHANNELS as reviewChannels }
