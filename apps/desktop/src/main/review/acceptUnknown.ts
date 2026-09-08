import { existsSync } from 'node:fs'
import type { MediaInspection } from '../../shared/mediaTypes'
import type { ReviewAcceptProgress, ReviewAcceptResult } from '../../shared/reviewTypes'
import type { DecisionRepository } from '../cosmos/decisionRepository'
import { acceptAndUploadMedia } from '../blob/acceptUploadPipeline'
import type { BlobUploadStore } from '../blob/blobUploader'
import { isMediaPath } from '../media/mediaType'
import { moveMediaIntoWorkingFolder } from '../workingFolder'

/**
 * Accept unknown: Cosms full + Blob SYNCED, then move to preserve/.
 * On upload failure the source is left unmoved (retryable).
 */
export async function acceptUnknownMedia(args: {
  inspection: MediaInspection
  userId: string
  workingRoot: string
  decisions: DecisionRepository
  blobs: BlobUploadStore
  moveFile?: typeof moveMediaIntoWorkingFolder
  onProgress?: (progress: ReviewAcceptProgress) => void
}): Promise<ReviewAcceptResult> {
  const { inspection, userId, workingRoot, decisions, blobs, onProgress } = args
  const moveFile = args.moveFile ?? moveMediaIntoWorkingFolder

  if (!existsSync(inspection.sourcePath)) {
    throw new Error(`Source file not found: ${inspection.sourcePath}`)
  }
  if (!isMediaPath(inspection.sourcePath)) {
    throw new Error('Only previewable media files can be accepted.')
  }

  // Upload first — never move into preserve/ before SYNCED.
  const uploaded = await acceptAndUploadMedia({
    inspection,
    userId,
    decisions,
    blobs,
    onProgress,
  })

  if (uploaded.document.cloudStatus !== 'SYNCED') {
    throw Object.assign(
      new Error(`Cannot move to preserve/: cloudStatus is ${uploaded.document.cloudStatus}`),
      { acceptUploadResult: { ...uploaded, sourceMoved: false as const } },
    )
  }

  onProgress?.({
    phase: 'moving',
    sourcePath: inspection.sourcePath,
    bytesUploaded: inspection.fileSize,
    bytesTotal: inspection.fileSize,
    percent: inspection.fileSize > 0 ? 100 : null,
  })

  const moved = await moveFile({
    sourcePath: inspection.sourcePath,
    workingRoot,
    bucket: 'preserve',
    nameDisambiguator: inspection.contentHash.slice(0, 8),
  })

  return {
    userId,
    document: uploaded.document,
    blobUrl: uploaded.blobUrl,
    cloudObjectId: uploaded.cloudObjectId,
    statusTrail: uploaded.statusTrail,
    destinationPath: moved.destinationPath,
    sourceMoved: true,
  }
}
