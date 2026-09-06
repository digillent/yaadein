import { dialog, ipcMain } from 'electron'
import {
  ensureWorkingFolder,
  moveMediaIntoWorkingFolder,
  type WorkingBucket,
  WORKING_BUCKETS,
} from '../workingFolder'

const CHANNELS = {
  ensure: 'workingFolder:ensure',
  move: 'workingFolder:move',
  pickFile: 'workingFolder:pickFile',
  pickDirectory: 'workingFolder:pickDirectory',
} as const

function isWorkingBucket(value: unknown): value is WorkingBucket {
  return typeof value === 'string' && (WORKING_BUCKETS as readonly string[]).includes(value)
}

export function registerWorkingFolderIpc(): void {
  ipcMain.handle(CHANNELS.ensure, async (_event, workingRoot: unknown) => {
    if (typeof workingRoot !== 'string' || !workingRoot.trim()) {
      throw new Error('workingRoot must be a non-empty string')
    }
    await ensureWorkingFolder(workingRoot)
    return { ok: true as const }
  })

  ipcMain.handle(CHANNELS.pickDirectory, async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
    })
    if (result.canceled || result.filePaths.length === 0) {
      return null
    }
    return result.filePaths[0]
  })

  ipcMain.handle(CHANNELS.pickFile, async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
    })
    if (result.canceled || result.filePaths.length === 0) {
      return null
    }
    return result.filePaths[0]
  })

  ipcMain.handle(
    CHANNELS.move,
    async (
      _event,
      payload: {
        sourcePath?: unknown
        workingRoot?: unknown
        bucket?: unknown
        captureDateIso?: unknown
        nameDisambiguator?: unknown
      },
    ) => {
      if (typeof payload?.sourcePath !== 'string' || !payload.sourcePath) {
        throw new Error('sourcePath is required')
      }
      if (typeof payload.workingRoot !== 'string' || !payload.workingRoot.trim()) {
        throw new Error('workingRoot is required')
      }
      if (!isWorkingBucket(payload.bucket)) {
        throw new Error('bucket must be preserve, duplicate, or rejected')
      }

      let captureDate: Date | undefined
      if (payload.captureDateIso !== undefined && payload.captureDateIso !== null) {
        if (typeof payload.captureDateIso !== 'string') {
          throw new Error('captureDateIso must be a string when provided')
        }
        captureDate = new Date(payload.captureDateIso)
        if (Number.isNaN(captureDate.getTime())) {
          throw new Error('captureDateIso must be a valid ISO date')
        }
      }

      const nameDisambiguator =
        typeof payload.nameDisambiguator === 'string' && payload.nameDisambiguator.length > 0
          ? payload.nameDisambiguator
          : undefined

      return moveMediaIntoWorkingFolder({
        sourcePath: payload.sourcePath,
        workingRoot: payload.workingRoot,
        bucket: payload.bucket,
        captureDate,
        nameDisambiguator,
      })
    },
  )
}

export { CHANNELS as workingFolderChannels }
