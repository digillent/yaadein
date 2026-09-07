import type { MediaTags } from './mediaTypes'

export type TagDimension = 'people' | 'places' | 'events'

/** One selectable tag value under people / places / events. */
export type TagFilter = {
  dimension: TagDimension
  value: string
}

export type CherishMediaEntry = {
  absolutePath: string
  relativePath: string
  contentHash: string
  fileSize: number
  yearMonth: string | null
  tags: MediaTags
  /** True when Cosms has an ACCEPTED+SYNCED doc for this hash. */
  hasCosmosAccepted: boolean
  originalFilename: string
}

export type CherishListResult = {
  workingRoot: string
  files: CherishMediaEntry[]
  /** Cosms tags were loaded (signed in); otherwise tags are empty. */
  tagsFromCosmos: boolean
}
