export const WORKING_BUCKETS = ['preserve', 'duplicate', 'rejected'] as const

export type WorkingBucket = (typeof WORKING_BUCKETS)[number]

export type MoveMediaInput = {
  sourcePath: string
  workingRoot: string
  bucket: WorkingBucket
  /** Capture date used for YYYY/MM path segments (injected for tests / later EXIF). */
  captureDate: Date
  /** Optional short token (e.g. hash prefix) for collision-safe filenames. */
  nameDisambiguator?: string
}

export type MoveMediaResult = {
  destinationPath: string
  bucket: WorkingBucket
  yearMonth: string
}
