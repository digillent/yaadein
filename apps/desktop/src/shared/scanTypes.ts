import type { CloudDecision } from './decisionTypes'

export type ScanProgressPhase =
  | 'walking'
  | 'hashing'
  | 'looking_up'
  | 'moving'
  | 'done'
  | 'failed'

export type ScanProgress = {
  phase: ScanProgressPhase
  filesFound: number
  filesProcessed: number
  movedRejected: number
  movedDuplicate: number
  skippedUnknown: number
  errors: number
  currentPath?: string
  message?: string
}

export type ScanFileResult =
  | {
      sourcePath: string
      contentHash: string
      fileSize: number
      outcome: 'moved_rejected' | 'moved_duplicate'
      decision: CloudDecision
      destinationPath: string
    }
  | {
      sourcePath: string
      contentHash: string
      fileSize: number
      outcome: 'skipped_unknown'
    }
  | {
      sourcePath: string
      outcome: 'error'
      error: string
    }

export type ScanClassifyResult = {
  filesFound: number
  movedRejected: number
  movedDuplicate: number
  skippedUnknown: number
  errors: number
  results: ScanFileResult[]
}

export type ScanClassifyRequest = {
  scanRoots: string[]
  workingRoot: string
}
