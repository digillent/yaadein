import { existsSync } from 'node:fs'
import type { MediaInspection } from '../../shared/mediaTypes'
import type { CloudStatus, MediaDecisionDocument } from '../../shared/decisionTypes'
import type { ReviewAcceptProgress } from '../../shared/reviewTypes'
import type { DecisionRepository } from '../cosmos/decisionRepository'
import { buildCloudObjectId } from './blobConfig'
import type { BlobUploadStore } from './blobUploader'

export type AcceptUploadResult = {
  document: MediaDecisionDocument
  blobUrl: string | null
  cloudObjectId: string | null
  statusTrail: CloudStatus[]
  /** M6 never moves into preserve/; review milestone gates on SYNCED. */
  sourceMoved: false
}

function emitProgress(
  onProgress: ((progress: ReviewAcceptProgress) => void) | undefined,
  progress: ReviewAcceptProgress,
): void {
  onProgress?.(progress)
}

function percentOf(uploaded: number, total: number): number | null {
  if (total <= 0) {
    return null
  }
  return Math.min(100, Math.round((uploaded / total) * 100))
}

/**
 * Cosms ACCEPTED (PENDING) → UPLOADING → Blob upload → SYNCED (or FAILED).
 * Does not move the local file.
 */
export async function acceptAndUploadMedia(args: {
  inspection: MediaInspection
  userId: string
  decisions: DecisionRepository
  blobs: BlobUploadStore
  onProgress?: (progress: ReviewAcceptProgress) => void
}): Promise<AcceptUploadResult> {
  const { inspection, userId, decisions, blobs, onProgress } = args
  const statusTrail: CloudStatus[] = []
  const bytesTotal = inspection.fileSize

  if (!existsSync(inspection.sourcePath)) {
    throw new Error(`Source file not found: ${inspection.sourcePath}`)
  }

  const cloudObjectId = buildCloudObjectId(userId, inspection.contentHash)

  emitProgress(onProgress, {
    phase: 'preparing',
    sourcePath: inspection.sourcePath,
    bytesUploaded: 0,
    bytesTotal,
    percent: percentOf(0, bytesTotal),
  })

  let document = await decisions.upsertAccepted({
    contentHash: inspection.contentHash,
    fileSize: inspection.fileSize,
    mediaType: inspection.mediaType,
    originalFilename: inspection.originalFilename,
    captureDate: inspection.captureDate,
    organizeDate: inspection.organizeDate,
    width: inspection.width,
    height: inspection.height,
    duration: inspection.duration,
    tags: inspection.tags,
    cloudStatus: 'PENDING',
  })
  statusTrail.push('PENDING')

  document = await decisions.updateCloudSync(inspection.contentHash, {
    cloudStatus: 'UPLOADING',
    cloudObjectId,
  })
  statusTrail.push('UPLOADING')

  emitProgress(onProgress, {
    phase: 'uploading',
    sourcePath: inspection.sourcePath,
    bytesUploaded: 0,
    bytesTotal,
    percent: percentOf(0, bytesTotal),
  })

  try {
    const uploaded = await blobs.uploadFile({
      cloudObjectId,
      localPath: inspection.sourcePath,
      contentType: inspection.mediaType,
      onProgress: (loadedBytes) => {
        emitProgress(onProgress, {
          phase: 'uploading',
          sourcePath: inspection.sourcePath,
          bytesUploaded: loadedBytes,
          bytesTotal,
          percent: percentOf(loadedBytes, bytesTotal),
        })
      },
    })

    document = await decisions.updateCloudSync(inspection.contentHash, {
      cloudStatus: 'SYNCED',
      cloudObjectId: uploaded.cloudObjectId,
    })
    statusTrail.push('SYNCED')

    return {
      document,
      blobUrl: uploaded.blobUrl,
      cloudObjectId: uploaded.cloudObjectId,
      statusTrail,
      sourceMoved: false,
    }
  } catch (error) {
    document = await decisions.updateCloudSync(inspection.contentHash, {
      cloudStatus: 'FAILED',
      cloudObjectId,
    })
    statusTrail.push('FAILED')
    const message = error instanceof Error ? error.message : String(error)
    throw Object.assign(new Error(`Blob upload failed: ${message}`), {
      acceptUploadResult: {
        document,
        blobUrl: null,
        cloudObjectId,
        statusTrail,
        sourceMoved: false as const,
      } satisfies AcceptUploadResult,
    })
  }
}
