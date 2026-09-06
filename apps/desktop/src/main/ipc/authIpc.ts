import { app, ipcMain } from 'electron'
import { join } from 'node:path'
import { AuthService, type AuthSession, type GraphMeProfile } from '../auth'

const CHANNELS = {
  getSession: 'auth:getSession',
  signIn: 'auth:signIn',
  signOut: 'auth:signOut',
  fetchMe: 'auth:fetchMe',
} as const

let authService: AuthService | null = null
let initPromise: Promise<void> | null = null

async function getAuthService(): Promise<AuthService> {
  if (!authService) {
    const cachePath = join(app.getPath('userData'), 'msal-cache.json')
    authService = new AuthService(cachePath)
    initPromise = authService.initialize()
  }
  await initPromise
  return authService
}

export function registerAuthIpc(): void {
  ipcMain.handle(CHANNELS.getSession, async (): Promise<AuthSession> => {
    return (await getAuthService()).getSession()
  })

  ipcMain.handle(CHANNELS.signIn, async (): Promise<AuthSession> => {
    return (await getAuthService()).signInInteractive()
  })

  ipcMain.handle(CHANNELS.signOut, async (): Promise<AuthSession> => {
    return (await getAuthService()).signOut()
  })

  ipcMain.handle(CHANNELS.fetchMe, async (): Promise<GraphMeProfile> => {
    return (await getAuthService()).fetchMeProfile()
  })
}

export { CHANNELS as authChannels }
