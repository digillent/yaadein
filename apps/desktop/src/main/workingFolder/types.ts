export const WORKING_BUCKETS = ['preserve', 'duplicate', 'rejected'] as const

export type WorkingBucket = (typeof WORKING_BUCKETS)[number]

export type MoveMediaInput = {
  sourcePath: string
  workingRoot: string
  bucket: WorkingBucket
  /**
   * Capture/event date for YYYY/MM.
   * When omitted: EXIF (later) or oldest usable filesystem timestamp.
   * When set (tests or **user override**): always used for organization path.
   */
  captureDate?: Date
  /** Optional short token (e.g. hash prefix) for collision-safe filenames. */
  nameDisambiguator?: string
}

export type MoveMediaResult = {
  destinationPath: string
  bucket: WorkingBucket
  yearMonth: string
}
