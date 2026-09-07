/** Resolved pair for duplicate vs Cosms-accepted original. */
export type DuplicateOriginalStatus = 'local' | 'downloaded' | 'unavailable'

export type DuplicateComparePair = {
  duplicatePath: string
  duplicateRelativePath: string
  contentHash: string
  fileSize: number
  original: {
    status: DuplicateOriginalStatus
    /** Local path for preview (preserve/ or just-downloaded). */
    path: string | null
    cloudObjectId: string | null
    detail: string
  }
}
