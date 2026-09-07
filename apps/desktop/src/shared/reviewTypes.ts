import type { MediaInspection } from './mediaTypes'
import type { CloudStatus, MediaDecisionDocument } from './decisionTypes'

export type ReviewRejectResult = {
  inspection: MediaInspection
  document: MediaDecisionDocument
  destinationPath: string
  sourceMoved: true
}

export type ReviewAcceptResult = {
  userId: string
  document: MediaDecisionDocument
  blobUrl: string | null
  cloudObjectId: string | null
  statusTrail: CloudStatus[]
  destinationPath: string
  sourceMoved: true
}

export type MediaPreview = {
  sourcePath: string
  mediaType: string
  /** data: URL for images; null for non-previewable types in M8 harness. */
  dataUrl: string | null
}
