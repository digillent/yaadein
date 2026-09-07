export type ScanProgressPhase =
  | 'walking'
  | 'sizing'
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
  /** Count of sizes that appear on 2+ files (peer-hash candidates). */
  peerCandidateSizeCount?: number
  currentPath?: string
  message?: string
}

export type ScanFileResult =
  | {
      sourcePath: string
      contentHash: string
      fileSize: number
      outcome: 'moved_rejected'
      decision: 'REJECTED'
      destinationPath: string
    }
  | {
      sourcePath: string
      contentHash: string
      fileSize: number
      outcome: 'moved_duplicate'
      /** Cosms ACCEPTED match, or another file in this scan with the same hash. */
      duplicateOf: 'cosmos_accepted' | 'scan_peer'
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
  peerCandidateSizeCount: number
  results: ScanFileResult[]
}

export type ScanClassifyRequest = {
  scanRoots: string[]
  workingRoot: string
}
