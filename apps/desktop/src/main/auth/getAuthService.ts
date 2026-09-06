import { join } from 'node:path'
import { AuthService } from './authService'

let authService: AuthService | null = null
let initPromise: Promise<void> | null = null

/** Shared AuthService for auth IPC and Cosms/Blob adapters. */
export async function getAuthService(userDataPath: string): Promise<AuthService> {
  if (!authService) {
    const cachePath = join(userDataPath, 'msal-cache.json')
    authService = new AuthService(cachePath)
    initPromise = authService.initialize()
  }
  await initPromise
  return authService
}

/** Test helper — clears the singleton between suites if needed. */
export function resetAuthServiceForTests(): void {
  authService = null
  initPromise = null
}
