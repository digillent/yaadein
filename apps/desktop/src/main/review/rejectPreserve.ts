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
 * 1) delete Blob for the ACCEPTED original
 * 2) Cosms lean REJECTED (overwrites ACCEPTED)
 * 3) move local file to rejected/
 * Previewable media only.
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

  await blobs.deleteFile({ cloudObjectId })

  return rejectUnknownMedia({
    inspection,
    workingRoot,
    decisions,
    moveFile: args.moveFile,
  })
}
