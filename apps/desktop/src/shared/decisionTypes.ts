import type { MediaTags } from './mediaTypes'

/** Persisted Cosms decisions only — never write DUPLICATE docs. */
export type CloudDecision = 'ACCEPTED' | 'REJECTED'

export type CloudStatus =
  | 'NOT_REQUIRED'
  | 'PENDING'
  | 'UPLOADING'
  | 'SYNCED'
  | 'FAILED'

/** Lean REJECTED document shape (Cosms). */
export type RejectedDecisionInput = {
  contentHash: string
  fileSize: number
  decidedAt?: string
}

/** Full ACCEPTED document shape (Cosms). Blob sync is M6. */
export type AcceptedDecisionInput = {
  contentHash: string
  fileSize: number
  mediaType: string
  originalFilename: string
  captureDate: string | null
  organizeDate: string
  width: number | null
  height: number | null
  duration: number | null
  tags: MediaTags
  cloudStatus?: CloudStatus
  decidedAt?: string
}

export type MediaDecisionDocument = {
  id: string
  userId: string
  contentHash: string
  fileSize: number
  decision: CloudDecision
  decidedAt: string
  mediaType?: string
  originalFilename?: string
  captureDate?: string | null
  organizeDate?: string
  width?: number | null
  height?: number | null
  duration?: number | null
  tags?: MediaTags
  cloudStatus?: CloudStatus
  cloudObjectId?: string | null
}

export type CosmosHarnessResult = {
  userId: string
  upserted: MediaDecisionDocument
  lookedUp: MediaDecisionDocument | null
}

export type AcceptUploadHarnessResult = {
  userId: string
  document: MediaDecisionDocument
  blobUrl: string | null
  cloudObjectId: string | null
  statusTrail: CloudStatus[]
  sourceMoved: false
}
