import { resolve } from 'node:path'
import { existsSync } from 'node:fs'
import type { MediaInspection } from '../../shared/mediaTypes'
import type { ReviewRejectResult } from '../../shared/reviewTypes'
import type { DecisionRepository } from '../cosmos/decisionRepository'
import { buildCloudObjectId } from '../blob/blobConfig'
import type { BlobMediaStore } from '../blob/blobUploader'
import { isMediaPath } from '../media/mediaType'
import { rejectUnknownMedia } from './rejectUnknown'
import {
  bucketDirectory,
  isPathInsideRoot,
  moveMediaIntoWorkingFolder,
} from '../workingFolder'

/**
 * Reject a keeper under preserve/:
 * 1) Cosms lean REJECTED (overwrites ACCEPTED)
 * 2) move local file to rejected/
 * 3) delete Blob for the former ACCEPTED original
 * Previewable media only. Blob delete runs last so a Cosms/move failure
 * does not leave ACCEPTED without cloud bytes.
 */
export async function rejectPreserveMedia(args: {
  inspection: MediaInspection
  workingRoot: string
  decisions: DecisionRepository
  blobs: BlobMediaStore
  moveFile?: typeof moveMediaIntoWorkingFolder
}): Promise<ReviewRejectResult> {
  const { inspection, workingRoot, decisions, blobs } = args
  if (!existsSync(inspection.sourcePath)) {
    throw new Error(`Source file not found: ${inspection.sourcePath}`)
  }
  if (!isMediaPath(inspection.sourcePath)) {
    throw new Error('Reject-from-preserve only allows previewable media files.')
  }

  const preserveRoot = bucketDirectory(resolve(workingRoot), 'preserve')
  if (!isPathInsideRoot(preserveRoot, resolve(inspection.sourcePath))) {
    throw new Error('Reject-from-preserve requires the file to be under preserve/.')
  }

  const userId = decisions.requireUserId()
  const docs = await decisions.lookupByHashes([inspection.contentHash])
  const accepted = docs.find((d) => d.decision === 'ACCEPTED') ?? null
  const cloudObjectId =
    accepted?.cloudObjectId?.trim() || buildCloudObjectId(userId, inspection.contentHash)

  const result = await rejectUnknownMedia({
    inspection,
    workingRoot,
    decisions,
    moveFile: args.moveFile,
  })

  try {
    await blobs.deleteFile({ cloudObjectId })
  } catch (error) {
    throw new Error(
      `Moved to rejected/ and Cosms REJECTED, but Blob delete failed (${cloudObjectId}): ${
        error instanceof Error ? error.message : String(error)
      }`,
    )
  }

  return result
}
