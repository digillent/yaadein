import { contextBridge, ipcRenderer } from 'electron'
import { appName } from '../shared/appInfo'
import type { MediaInspection, MediaTags } from '../shared/mediaTypes'
import type { AuthSession, GraphMeProfile } from '../shared/authTypes'

export type WorkingBucket = 'preserve' | 'duplicate' | 'rejected'


export type MoveMediaPayload = {
  sourcePath: string
  workingRoot: string
  bucket: WorkingBucket
  /**
   * Optional user override for organize/event date.
   * When omitted, main uses EXIF then oldest usable filesystem timestamp.
   */
  captureDateIso?: string
  nameDisambiguator?: string
}

export type MoveMediaResult = {
  destinationPath: string
  bucket: WorkingBucket
  yearMonth: string
}

export type { MediaInspection, MediaTags, AuthSession, GraphMeProfile }

const api = {
  appName,
  ensureWorkingFolder: (workingRoot: string): Promise<{ ok: true }> =>
    ipcRenderer.invoke('workingFolder:ensure', workingRoot),
  pickWorkingDirectory: (): Promise<string | null> =>
    ipcRenderer.invoke('workingFolder:pickDirectory'),
  pickSourceFile: (): Promise<string | null> => ipcRenderer.invoke('workingFolder:pickFile'),
  moveMedia: (payload: MoveMediaPayload): Promise<MoveMediaResult> =>
    ipcRenderer.invoke('workingFolder:move', payload),
  inspectMedia: (payload: {
    sourcePath: string
    captureDateIso?: string
  }): Promise<MediaInspection> => ipcRenderer.invoke('media:inspect', payload),
  getAuthSession: (): Promise<AuthSession> => ipcRenderer.invoke('auth:getSession'),
  signIn: (): Promise<AuthSession> => ipcRenderer.invoke('auth:signIn'),
  signOut: (): Promise<AuthSession> => ipcRenderer.invoke('auth:signOut'),
  fetchMe: (): Promise<GraphMeProfile> => ipcRenderer.invoke('auth:fetchMe'),
}

contextBridge.exposeInMainWorld('yaadein', api)

export type YaadeinApi = typeof api
