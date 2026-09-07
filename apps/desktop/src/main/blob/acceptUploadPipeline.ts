import { existsSync } from 'node:fs'
import type { MediaInspection } from '../../shared/mediaTypes'
import type { CloudStatus, MediaDecisionDocument } from '../../shared/decisionTypes'
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

/**
 * Cosms ACCEPTED (PENDING) → UPLOADING → Blob upload → SYNCED (or FAILED).
 * Does not move the local file.
 */
export async function acceptAndUploadMedia(args: {
  inspection: MediaInspection
  userId: string
  decisions: DecisionRepository
  blobs: BlobUploadStore
}): Promise<AcceptUploadResult> {
  const { inspection, userId, decisions, blobs } = args
  const statusTrail: CloudStatus[] = []

  if (!existsSync(inspection.sourcePath)) {
    throw new Error(`Source file not found: ${inspection.sourcePath}`)
  }

  const cloudObjectId = buildCloudObjectId(userId, inspection.contentHash)

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

  try {
    const uploaded = await blobs.uploadFile({
      cloudObjectId,
      localPath: inspection.sourcePath,
      contentType: inspection.mediaType,
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
