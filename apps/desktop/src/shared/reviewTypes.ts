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

export type MediaPreviewKind = 'image' | 'video' | 'unsupported'

export type MediaPreview = {
  sourcePath: string
  mediaType: string
  kind: MediaPreviewKind
  /** Custom protocol URL for img/video elements (works for large files). */
  streamUrl: string | null
  /** Optional inline data URL for small images; prefer streamUrl when both set. */
  dataUrl: string | null
}
