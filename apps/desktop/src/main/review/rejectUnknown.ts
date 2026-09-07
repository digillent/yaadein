import { existsSync } from 'node:fs'
import type { MediaInspection } from '../../shared/mediaTypes'
import type { ReviewRejectResult } from '../../shared/reviewTypes'
import type { DecisionRepository } from '../cosmos/decisionRepository'
import { isMediaPath } from '../media/mediaType'
import { moveMediaIntoWorkingFolder } from '../workingFolder'

/**
 * Reject unknown: Cosms lean REJECTED, then move to rejected/.
 */
export async function rejectUnknownMedia(args: {
  inspection: MediaInspection
  workingRoot: string
  decisions: DecisionRepository
  moveFile?: typeof moveMediaIntoWorkingFolder
}): Promise<ReviewRejectResult> {
  const { inspection, workingRoot, decisions } = args
  const moveFile = args.moveFile ?? moveMediaIntoWorkingFolder

  if (!existsSync(inspection.sourcePath)) {
    throw new Error(`Source file not found: ${inspection.sourcePath}`)
  }
  if (!isMediaPath(inspection.sourcePath)) {
    throw new Error('Only previewable media files can be rejected.')
  }

  const document = await decisions.upsertRejected({
    contentHash: inspection.contentHash,
    fileSize: inspection.fileSize,
  })

  const moved = await moveFile({
    sourcePath: inspection.sourcePath,
    workingRoot,
    bucket: 'rejected',
    nameDisambiguator: inspection.contentHash.slice(0, 8),
  })

  return {
    inspection,
    document,
    destinationPath: moved.destinationPath,
    sourceMoved: true,
  }
}
