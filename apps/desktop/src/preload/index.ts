import { contextBridge, ipcRenderer } from 'electron'
import { appName } from '../shared/appInfo'

export type WorkingBucket = 'preserve' | 'duplicate' | 'rejected'

export type MoveMediaPayload = {
  sourcePath: string
  workingRoot: string
  bucket: WorkingBucket
  captureDateIso: string
  nameDisambiguator?: string
}

export type MoveMediaResult = {
  destinationPath: string
  bucket: WorkingBucket
  yearMonth: string
}

const api = {
  appName,
  ensureWorkingFolder: (workingRoot: string): Promise<{ ok: true }> =>
    ipcRenderer.invoke('workingFolder:ensure', workingRoot),
  pickWorkingDirectory: (): Promise<string | null> =>
    ipcRenderer.invoke('workingFolder:pickDirectory'),
  pickSourceFile: (): Promise<string | null> => ipcRenderer.invoke('workingFolder:pickFile'),
  moveMedia: (payload: MoveMediaPayload): Promise<MoveMediaResult> =>
    ipcRenderer.invoke('workingFolder:move', payload),
}

contextBridge.exposeInMainWorld('yaadein', api)

export type YaadeinApi = typeof api
