import { resolve } from 'node:path'
import { existsSync } from 'node:fs'
import type { MediaInspection } from '../../shared/mediaTypes'
import type { ReviewAcceptResult } from '../../shared/reviewTypes'
import type { DecisionRepository } from '../cosmos/decisionRepository'
import type { BlobUploadStore } from '../blob/blobUploader'
import { acceptUnknownMedia } from './acceptUnknown'
import {
  bucketDirectory,
  isPathInsideRoot,
  moveMediaIntoWorkingFolder,
} from '../workingFolder'

/**
 * Accept a file under rejected/: Cosms full ACCEPTED + Blob SYNCED → preserve/.
 * Overwrites the lean REJECTED Cosms document (same id = contentHash).
 */
export async function acceptRejectedMedia(args: {
  inspection: MediaInspection
  userId: string
  workingRoot: string
  decisions: DecisionRepository
  blobs: BlobUploadStore
  moveFile?: typeof moveMediaIntoWorkingFolder
  onProgress?: Parameters<typeof acceptUnknownMedia>[0]['onProgress']
}): Promise<ReviewAcceptResult> {
  const { inspection, workingRoot } = args
  if (!existsSync(inspection.sourcePath)) {
    throw new Error(`Source file not found: ${inspection.sourcePath}`)
  }

  const rejectedRoot = bucketDirectory(resolve(workingRoot), 'rejected')
  if (!isPathInsideRoot(rejectedRoot, resolve(inspection.sourcePath))) {
    throw new Error('Accept-from-rejected requires the file to be under rejected/.')
  }

  return acceptUnknownMedia(args)
}
