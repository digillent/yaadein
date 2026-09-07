export type RestoreProgress = {
  phase: 'listing' | 'downloading' | 'verifying' | 'done' | 'failed'
  total: number
  completed: number
  skipped: number
  failed: number
  currentHash?: string
  message?: string
}

export type RestoreItemResult =
  | {
      contentHash: string
      outcome: 'restored'
      destinationPath: string
    }
  | {
      contentHash: string
      outcome: 'skipped_exists'
      destinationPath: string
    }
  | {
      contentHash: string
      outcome: 'failed'
      error: string
    }

export type RestorePreserveResult = {
  total: number
  restored: number
  skipped: number
  failed: number
  results: RestoreItemResult[]
}
