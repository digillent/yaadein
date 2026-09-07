export type CleanupBucket = 'rejected' | 'duplicate'

export const CLEANUP_BUCKETS = ['rejected', 'duplicate'] as const

export type CleanupFileEntry = {
  absolutePath: string
  relativePath: string
  sizeBytes: number
}

export type CleanupListResult = {
  workingRoot: string
  bucket: CleanupBucket
  files: CleanupFileEntry[]
  totalBytes: number
}

export type CleanupDeleteResult = {
  workingRoot: string
  bucket: CleanupBucket
  deleted: string[]
  failed: Array<{ path: string; error: string }>
  /** True when the user cancelled the confirmation dialog. */
  cancelled: boolean
}
