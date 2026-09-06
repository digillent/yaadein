import { ipcMain } from 'electron'
import { inspectMediaFile } from '../media'

const CHANNELS = {
  inspect: 'media:inspect',
} as const

export function registerMediaIpc(): void {
  ipcMain.handle(
    CHANNELS.inspect,
    async (
      _event,
      payload: {
        sourcePath?: unknown
        captureDateIso?: unknown
      },
    ) => {
      if (typeof payload?.sourcePath !== 'string' || !payload.sourcePath) {
        throw new Error('sourcePath is required')
      }

      let userOverrideDate: Date | undefined
      if (payload.captureDateIso !== undefined && payload.captureDateIso !== null) {
        if (typeof payload.captureDateIso !== 'string') {
          throw new Error('captureDateIso must be a string when provided')
        }
        userOverrideDate = new Date(payload.captureDateIso)
        if (Number.isNaN(userOverrideDate.getTime())) {
          throw new Error('captureDateIso must be a valid ISO date')
        }
      }

      return inspectMediaFile(payload.sourcePath, { userOverrideDate })
    },
  )
}

export { CHANNELS as mediaChannels }
