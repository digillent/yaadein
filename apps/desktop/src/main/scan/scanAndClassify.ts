import type { MediaDecisionDocument } from '../../shared/decisionTypes'
import type {
  ScanClassifyRequest,
  ScanClassifyResult,
  ScanFileResult,
  ScanProgress,
} from '../../shared/scanTypes'
import { hashFileContent } from '../media/hashFile'
import { moveMediaIntoWorkingFolder } from '../workingFolder'
import type { WorkingBucket } from '../workingFolder/types'
import { walkMediaFiles } from './walkMediaFiles'

export const SCAN_LOOKUP_BATCH_SIZE = 25

export type ScanDecisionLookup = {
  lookupByHashes(hashes: string[]): Promise<MediaDecisionDocument[]>
}

export type ScanClassifyDeps = {
  requireSignedIn: () => void
  decisions: ScanDecisionLookup
  walk?: (roots: string[]) => Promise<string[]>
  hashFile?: typeof hashFileContent
  moveFile?: typeof moveMediaIntoWorkingFolder
  batchSize?: number
  onProgress?: (progress: ScanProgress) => void
}

/**
 * Hash media under scan roots, batch-lookup Cosms, auto-move known decisions.
 * ACCEPTED → duplicate/; REJECTED → rejected/; unknown → skip (M8 review).
 * Does not touch Blob. Fails closed when not signed in.
 */
export async function scanAndClassify(
  request: ScanClassifyRequest,
  deps: ScanClassifyDeps,
): Promise<ScanClassifyResult> {
  deps.requireSignedIn()

  const scanRoots = request.scanRoots.map((r) => r.trim()).filter(Boolean)
  if (scanRoots.length === 0) {
    throw new Error('At least one scan root is required.')
  }
  if (!request.workingRoot.trim()) {
    throw new Error('workingRoot is required.')
  }

  const walk = deps.walk ?? walkMediaFiles
  const hashFile = deps.hashFile ?? hashFileContent
  const moveFile = deps.moveFile ?? moveMediaIntoWorkingFolder
  const batchSize = deps.batchSize ?? SCAN_LOOKUP_BATCH_SIZE

  const progress: ScanProgress = {
    phase: 'walking',
    filesFound: 0,
    filesProcessed: 0,
    movedRejected: 0,
    movedDuplicate: 0,
    skippedUnknown: 0,
    errors: 0,
  }
  emit(deps, progress)

  const mediaPaths = await walk(scanRoots)
  progress.filesFound = mediaPaths.length
  emit(deps, progress)

  const results: ScanFileResult[] = []

  for (let offset = 0; offset < mediaPaths.length; offset += batchSize) {
    const chunk = mediaPaths.slice(offset, offset + batchSize)
    const hashed: Array<{ sourcePath: string; contentHash: string; fileSize: number }> = []

    progress.phase = 'hashing'
    for (const sourcePath of chunk) {
      progress.currentPath = sourcePath
      emit(deps, progress)
      try {
        const { contentHash, fileSize } = await hashFile(sourcePath)
        hashed.push({ sourcePath, contentHash, fileSize })
      } catch (error) {
        progress.errors += 1
        progress.filesProcessed += 1
        results.push({
          sourcePath,
          outcome: 'error',
          error: error instanceof Error ? error.message : String(error),
        })
        emit(deps, progress)
      }
    }

    progress.phase = 'looking_up'
    emit(deps, progress)

    const byHash = new Map<string, MediaDecisionDocument>()
    if (hashed.length > 0) {
      try {
        const docs = await deps.decisions.lookupByHashes(hashed.map((h) => h.contentHash))
        for (const doc of docs) {
          byHash.set(doc.contentHash, doc)
        }
      } catch (error) {
        progress.phase = 'failed'
        progress.message = error instanceof Error ? error.message : String(error)
        emit(deps, progress)
        throw new Error(
          `Cosmos lookup failed (scan requires network + sign-in): ${progress.message}`,
        )
      }
    }

    progress.phase = 'moving'
    for (const item of hashed) {
      progress.currentPath = item.sourcePath
      emit(deps, progress)
      try {
        const known = byHash.get(item.contentHash)
        if (!known) {
          progress.skippedUnknown += 1
          progress.filesProcessed += 1
          results.push({
            sourcePath: item.sourcePath,
            contentHash: item.contentHash,
            fileSize: item.fileSize,
            outcome: 'skipped_unknown',
          })
          emit(deps, progress)
          continue
        }

        const bucket: WorkingBucket = known.decision === 'REJECTED' ? 'rejected' : 'duplicate'
        // Known ACCEPTED hashes are local duplicates only (no Cosms DUPLICATE doc).
        const moved = await moveFile({
          sourcePath: item.sourcePath,
          workingRoot: request.workingRoot,
          bucket,
          nameDisambiguator: item.contentHash.slice(0, 8),
        })

        if (bucket === 'rejected') {
          progress.movedRejected += 1
          results.push({
            sourcePath: item.sourcePath,
            contentHash: item.contentHash,
            fileSize: item.fileSize,
            outcome: 'moved_rejected',
            decision: 'REJECTED',
            destinationPath: moved.destinationPath,
          })
        } else {
          progress.movedDuplicate += 1
          results.push({
            sourcePath: item.sourcePath,
            contentHash: item.contentHash,
            fileSize: item.fileSize,
            outcome: 'moved_duplicate',
            decision: 'ACCEPTED',
            destinationPath: moved.destinationPath,
          })
        }
        progress.filesProcessed += 1
        emit(deps, progress)
      } catch (error) {
        progress.errors += 1
        progress.filesProcessed += 1
        results.push({
          sourcePath: item.sourcePath,
          outcome: 'error',
          error: error instanceof Error ? error.message : String(error),
        })
        emit(deps, progress)
      }
    }
  }

  progress.phase = 'done'
  progress.currentPath = undefined
  emit(deps, progress)

  return {
    filesFound: progress.filesFound,
    movedRejected: progress.movedRejected,
    movedDuplicate: progress.movedDuplicate,
    skippedUnknown: progress.skippedUnknown,
    errors: progress.errors,
    results,
  }
}

function emit(deps: ScanClassifyDeps, progress: ScanProgress): void {
  deps.onProgress?.({ ...progress })
}
