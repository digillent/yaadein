import { app, ipcMain } from 'electron'
import type { PersistedDesktopSettings } from '../../shared/persistedSettingsTypes'
import { loadPersistedSettings, savePersistedSettings } from '../settings/persistedSettings'

const CHANNELS = {
  get: 'settings:get',
  save: 'settings:save',
} as const

export function registerSettingsIpc(): void {
  ipcMain.handle(CHANNELS.get, async (): Promise<PersistedDesktopSettings> => {
    return loadPersistedSettings(app.getPath('userData'))
  })

  ipcMain.handle(
    CHANNELS.save,
    async (
      _event,
      patch: { workingRoot?: unknown; scanRoot?: unknown },
    ): Promise<PersistedDesktopSettings> => {
      const next: Partial<PersistedDesktopSettings> = {}
      if (patch?.workingRoot !== undefined) {
        if (typeof patch.workingRoot !== 'string') {
          throw new Error('workingRoot must be a string')
        }
        next.workingRoot = patch.workingRoot
      }
      if (patch?.scanRoot !== undefined) {
        if (typeof patch.scanRoot !== 'string') {
          throw new Error('scanRoot must be a string')
        }
        next.scanRoot = patch.scanRoot
      }
      return savePersistedSettings(app.getPath('userData'), next)
    },
  )
}

export { CHANNELS as settingsChannels }
