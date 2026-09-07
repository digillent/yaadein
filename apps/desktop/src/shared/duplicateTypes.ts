/** Resolved pair for duplicate vs Cosms ACCEPTED original. */
export type DuplicateOriginalStatus = 'local' | 'downloaded' | 'unavailable'

export type DuplicateComparePair = {
  duplicatePath: string
  duplicateRelativePath: string
  contentHash: string
  fileSize: number
  original: {
    status: DuplicateOriginalStatus
    /** Local path for preview (preserve/ or just-downloaded ACCEPTED original). */
    path: string | null
    cloudObjectId: string | null
    detail: string
  }
}
