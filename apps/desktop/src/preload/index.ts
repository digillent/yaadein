import { contextBridge, ipcRenderer } from 'electron'
import { appName } from '../shared/appInfo'
import type { MediaInspection, MediaTags } from '../shared/mediaTypes'
import type { AuthSession, GraphMeProfile } from '../shared/authTypes'
import type { AcceptUploadHarnessResult, CosmosHarnessResult } from '../shared/decisionTypes'
import type { ScanClassifyRequest, ScanClassifyResult, ScanProgress } from '../shared/scanTypes'
import type {
  MediaPreview,
  ReviewAcceptResult,
  ReviewRejectResult,
} from '../shared/reviewTypes'
import type { CleanupBucket, CleanupDeleteResult, CleanupListResult } from '../shared/cleanupTypes'

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

export type {
  MediaInspection,
  MediaTags,
  AuthSession,
  GraphMeProfile,
  CosmosHarnessResult,
  AcceptUploadHarnessResult,
  ScanClassifyRequest,
  ScanClassifyResult,
  ScanProgress,
  MediaPreview,
  ReviewAcceptResult,
  ReviewRejectResult,
  CleanupBucket,
  CleanupListResult,
  CleanupDeleteResult,
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
  inspectMedia: (payload: {
    sourcePath: string
    captureDateIso?: string
  }): Promise<MediaInspection> => ipcRenderer.invoke('media:inspect', payload),
  getAuthSession: (): Promise<AuthSession> => ipcRenderer.invoke('auth:getSession'),
  signIn: (): Promise<AuthSession> => ipcRenderer.invoke('auth:signIn'),
  signOut: (): Promise<AuthSession> => ipcRenderer.invoke('auth:signOut'),
  fetchMe: (): Promise<GraphMeProfile> => ipcRenderer.invoke('auth:fetchMe'),
  cosmosHarnessRoundTrip: (): Promise<CosmosHarnessResult> =>
    ipcRenderer.invoke('cosmos:harnessRoundTrip'),
  acceptAndUpload: (payload: {
    sourcePath: string
    captureDateIso?: string
  }): Promise<AcceptUploadHarnessResult> => ipcRenderer.invoke('blob:acceptAndUpload', payload),
  runScan: (payload: ScanClassifyRequest): Promise<ScanClassifyResult> =>
    ipcRenderer.invoke('scan:run', payload),
  onScanProgress: (listener: (progress: ScanProgress) => void): (() => void) => {
    const handler = (_event: unknown, progress: ScanProgress): void => {
      listener(progress)
    }
    ipcRenderer.on('scan:progress', handler)
    return () => {
      ipcRenderer.removeListener('scan:progress', handler)
    }
  },
  previewMedia: (sourcePath: string): Promise<MediaPreview> =>
    ipcRenderer.invoke('review:preview', sourcePath),
  reviewAccept: (payload: {
    sourcePath: string
    workingRoot: string
    captureDateIso?: string
  }): Promise<ReviewAcceptResult> => ipcRenderer.invoke('review:accept', payload),
  reviewReject: (payload: {
    sourcePath: string
    workingRoot: string
    captureDateIso?: string
  }): Promise<ReviewRejectResult> => ipcRenderer.invoke('review:reject', payload),
  listCleanup: (payload: {
    workingRoot: string
    bucket: CleanupBucket
  }): Promise<CleanupListResult> => ipcRenderer.invoke('cleanup:list', payload),
  deleteCleanup: (payload: {
    workingRoot: string
    bucket: CleanupBucket
    paths: string[]
  }): Promise<CleanupDeleteResult> => ipcRenderer.invoke('cleanup:delete', payload),
}

contextBridge.exposeInMainWorld('yaadein', api)

export type YaadeinApi = typeof api
