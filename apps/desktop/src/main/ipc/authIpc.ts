import { app, ipcMain } from 'electron'
import { getAuthService } from '../auth/getAuthService'
import type { AuthSession, GraphMeProfile } from '../../shared/authTypes'

const CHANNELS = {
  getSession: 'auth:getSession',
  signIn: 'auth:signIn',
  signOut: 'auth:signOut',
  fetchMe: 'auth:fetchMe',
} as const

export function registerAuthIpc(): void {
  ipcMain.handle(CHANNELS.getSession, async (): Promise<AuthSession> => {
    return (await getAuthService(app.getPath('userData'))).getSession()
  })

  ipcMain.handle(CHANNELS.signIn, async (): Promise<AuthSession> => {
    return (await getAuthService(app.getPath('userData'))).signInInteractive()
  })

  ipcMain.handle(CHANNELS.signOut, async (): Promise<AuthSession> => {
    return (await getAuthService(app.getPath('userData'))).signOut()
  })

  ipcMain.handle(CHANNELS.fetchMe, async (): Promise<GraphMeProfile> => {
    return (await getAuthService(app.getPath('userData'))).fetchMeProfile()
  })
}

export { CHANNELS as authChannels }
