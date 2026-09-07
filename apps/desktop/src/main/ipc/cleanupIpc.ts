import { BrowserWindow, dialog, ipcMain } from 'electron'
import {
  assertCleanupBucket,
  deleteCleanupFiles,
  listCleanupFiles,
} from '../workingFolder/cleanupLocal'
import type { CleanupBucket, CleanupDeleteResult, CleanupListResult } from '../../shared/cleanupTypes'

const CHANNELS = {
  list: 'cleanup:list',
  delete: 'cleanup:delete',
} as const

export function registerCleanupIpc(): void {
  ipcMain.handle(
    CHANNELS.list,
    async (_event, payload: { workingRoot?: unknown; bucket?: unknown }): Promise<CleanupListResult> => {
      if (typeof payload?.workingRoot !== 'string' || !payload.workingRoot.trim()) {
        throw new Error('workingRoot is required')
      }
      if (typeof payload?.bucket !== 'string') {
        throw new Error('bucket is required')
      }
      assertCleanupBucket(payload.bucket)
      return listCleanupFiles(payload.workingRoot, payload.bucket)
    },
  )

  ipcMain.handle(
    CHANNELS.delete,
    async (
      event,
      payload: { workingRoot?: unknown; bucket?: unknown; paths?: unknown },
    ): Promise<CleanupDeleteResult> => {
      if (typeof payload?.workingRoot !== 'string' || !payload.workingRoot.trim()) {
        throw new Error('workingRoot is required')
      }
      if (typeof payload?.bucket !== 'string') {
        throw new Error('bucket is required')
      }
      assertCleanupBucket(payload.bucket)
      if (!Array.isArray(payload.paths) || payload.paths.some((p) => typeof p !== 'string')) {
        throw new Error('paths must be an array of strings')
      }
      const paths = payload.paths as string[]
      if (paths.length === 0) {
        return {
          workingRoot: payload.workingRoot,
          bucket: payload.bucket as CleanupBucket,
          deleted: [],
          failed: [],
          cancelled: false,
        }
      }

      const parent = BrowserWindow.fromWebContents(event.sender)
      const confirmation = await dialog.showMessageBox(parent ?? undefined, {
        type: 'warning',
        buttons: ['Cancel', 'Delete permanently'],
        defaultId: 0,
        cancelId: 0,
        title: 'Confirm local cleanup',
        message: `Permanently delete ${paths.length} file(s) from ${payload.bucket}/?`,
        detail:
          'This only removes local files under rejected/ or duplicate/. Cosmos decisions are kept. preserve/ is never touched.',
      })

      if (confirmation.response !== 1) {
        return {
          workingRoot: payload.workingRoot,
          bucket: payload.bucket as CleanupBucket,
          deleted: [],
          failed: [],
          cancelled: true,
        }
      }

      const result = await deleteCleanupFiles(
        payload.workingRoot,
        payload.bucket as CleanupBucket,
        paths,
      )
      return {
        workingRoot: payload.workingRoot,
        bucket: payload.bucket as CleanupBucket,
        deleted: result.deleted,
        failed: result.failed,
        cancelled: false,
      }
    },
  )
}

export { CHANNELS as cleanupChannels }
