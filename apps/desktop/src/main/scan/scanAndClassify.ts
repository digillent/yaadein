import { stat } from 'node:fs/promises'
import type { MediaDecisionDocument } from '../../shared/decisionTypes'
import type {
  ScanClassifyRequest,
  ScanClassifyResult,
  ScanFileResult,
  ScanProgress,
} from '../../shared/scanTypes'
import { hashFileContent } from '../media/hashFile'
import { moveMediaIntoWorkingFolder } from '../workingFolder'
import { pruneEmptyDirTree } from '../workingFolder/pruneEmptyDirs'
import { classifyExactDuplicate, peerCandidateSizes } from './exactDuplicates'
import { walkMediaFiles } from './walkMediaFiles'

export const SCAN_LOOKUP_BATCH_SIZE = 25

export type ScanDecisionLookup = {
  lookupByHashes(hashes: string[]): Promise<MediaDecisionDocument[]>
}

export type ScanClassifyDeps = {
  requireSignedIn: () => void
  decisions: ScanDecisionLookup
  walk?: (roots: string[], options?: { workingRoot?: string }) => Promise<string[]>
  hashFile?: typeof hashFileContent
  moveFile?: typeof moveMediaIntoWorkingFolder
  batchSize?: number
  onProgress?: (progress: ScanProgress) => void
}

/**
 * Walk → size-group peer candidates → hash → batch Cosms lookup → move knowns.
 * ACCEPTED (Cosms) or same-hash scan peer → duplicate/ (no Cosms DUPLICATE doc).
 * REJECTED → rejected/. Unknown first-of-hash → skip for review.
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
    peerCandidateSizeCount: 0,
  }
  emit(deps, progress)

  const mediaPaths = await walk(scanRoots, { workingRoot: request.workingRoot })
  progress.filesFound = mediaPaths.length
  emit(deps, progress)

  const results: ScanFileResult[] = []
  /** Hashes already classified in this scan (keeper unknown or moved). */
  const seenHashes = new Set<string>()

  progress.phase = 'sizing'
  const sized: Array<{ sourcePath: string; fileSize: number }> = []
  for (const sourcePath of mediaPaths) {
    progress.currentPath = sourcePath
    emit(deps, progress)
    try {
      const fileStat = await stat(sourcePath)
      sized.push({ sourcePath, fileSize: fileStat.size })
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
  const peerSizes = peerCandidateSizes(sized)
  progress.peerCandidateSizeCount = peerSizes.size
  emit(deps, progress)

  const pathsToHash = sized.map((f) => f.sourcePath)

  for (let offset = 0; offset < pathsToHash.length; offset += batchSize) {
    const chunk = pathsToHash.slice(offset, offset + batchSize)
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
        const classification = classifyExactDuplicate({
          contentHash: item.contentHash,
          cosmosDecision: known?.decision,
          cosmosCloudStatus: known?.cloudStatus,
          seenHashes,
        })

        if (classification.kind === 'unknown') {
          seenHashes.add(item.contentHash)
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

        const bucket = classification.kind === 'rejected' ? 'rejected' : 'duplicate'
        const moved = await moveFile({
          sourcePath: item.sourcePath,
          workingRoot: request.workingRoot,
          bucket,
          nameDisambiguator: item.contentHash.slice(0, 8),
        })
        seenHashes.add(item.contentHash)

        if (classification.kind === 'rejected') {
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
            duplicateOf: classification.reason,
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

  for (const scanRoot of scanRoots) {
    await pruneEmptyDirTree(scanRoot, { removeRoot: false })
  }

  return {
    filesFound: progress.filesFound,
    movedRejected: progress.movedRejected,
    movedDuplicate: progress.movedDuplicate,
    skippedUnknown: progress.skippedUnknown,
    errors: progress.errors,
    peerCandidateSizeCount: progress.peerCandidateSizeCount ?? 0,
    results,
  }
}

function emit(deps: ScanClassifyDeps, progress: ScanProgress): void {
  deps.onProgress?.({ ...progress })
}
