import { access, mkdir, rename, unlink } from 'node:fs/promises'
import { constants } from 'node:fs'
import { join } from 'node:path'
import type { MediaDecisionDocument } from '../../shared/decisionTypes'
import type {
  RestoreItemResult,
  RestorePreserveResult,
  RestoreProgress,
} from '../../shared/restoreTypes'
import { buildCloudObjectId } from '../blob/blobConfig'
import type { BlobMediaStore } from '../blob/blobUploader'
import { hashFileContent } from '../media/hashFile'
import { destinationDirectory, destinationFilePath } from '../workingFolder/paths'
import { ensureWorkingFolder } from '../workingFolder/ensureTree'

export type RestoreDecisions = {
  listAcceptedSynced(): Promise<MediaDecisionDocument[]>
  requireUserId(): string
}

export type RestoreDeps = {
  decisions: RestoreDecisions
  blobs: BlobMediaStore
  hashFile?: typeof hashFileContent
  onProgress?: (progress: RestoreProgress) => void
}

/**
 * Download ACCEPTED+SYNCED blobs with the user token, verify SHA-256,
 * and place files into preserve/YYYY/MM (from Cosms organizeDate).
 */
export async function restorePreserveFromCloud(
  workingRoot: string,
  deps: RestoreDeps,
): Promise<RestorePreserveResult> {
  if (!workingRoot.trim()) {
    throw new Error('workingRoot is required')
  }

  const hashFile = deps.hashFile ?? hashFileContent
  const progress: RestoreProgress = {
    phase: 'listing',
    total: 0,
    completed: 0,
    skipped: 0,
    failed: 0,
  }
  emit(deps, progress)

  await ensureWorkingFolder(workingRoot)
  const docs = await deps.decisions.listAcceptedSynced()
  const userId = deps.decisions.requireUserId()
  progress.total = docs.length
  emit(deps, progress)

  const results: RestoreItemResult[] = []

  for (const doc of docs) {
    progress.currentHash = doc.contentHash
    progress.phase = 'downloading'
    emit(deps, progress)

    try {
      if (doc.decision !== 'ACCEPTED' || doc.cloudStatus !== 'SYNCED') {
        throw new Error('Document is not ACCEPTED+SYNCED')
      }

      const organizeDate = resolveOrganizeDate(doc)
      const filename = doc.originalFilename?.trim() || `${doc.contentHash}.bin`
      const primaryPath = destinationFilePath(
        workingRoot,
        'preserve',
        organizeDate,
        filename,
        doc.contentHash.slice(0, 8),
        0,
      )

      if (await pathExists(primaryPath)) {
        const existing = await hashFile(primaryPath)
        if (existing.contentHash === doc.contentHash) {
          progress.skipped += 1
          progress.completed += 1
          results.push({
            contentHash: doc.contentHash,
            outcome: 'skipped_exists',
            destinationPath: primaryPath,
          })
          emit(deps, progress)
          continue
        }
      }

      const destinationPath = await resolveUniqueDestination(
        workingRoot,
        organizeDate,
        filename,
        doc.contentHash.slice(0, 8),
      )

      const destDir = destinationDirectory(workingRoot, 'preserve', organizeDate)
      await mkdir(destDir, { recursive: true })
      const tempPath = join(destDir, `.yaadein-restore-${doc.contentHash}.partial`)

      const cloudObjectId =
        doc.cloudObjectId?.trim() || buildCloudObjectId(userId, doc.contentHash)

      try {
        await deps.blobs.downloadFile({ cloudObjectId, localPath: tempPath })
        progress.phase = 'verifying'
        emit(deps, progress)

        const verified = await hashFile(tempPath)
        if (verified.contentHash !== doc.contentHash) {
          throw new Error(
            `Hash mismatch after download (expected ${doc.contentHash.slice(0, 12)}…)`,
          )
        }
        if (verified.fileSize !== doc.fileSize) {
          throw new Error(
            `Size mismatch after download (expected ${doc.fileSize}, got ${verified.fileSize})`,
          )
        }

        await rename(tempPath, destinationPath)
      } finally {
        await unlink(tempPath).catch(() => undefined)
      }

      progress.completed += 1
      results.push({
        contentHash: doc.contentHash,
        outcome: 'restored',
        destinationPath,
      })
      emit(deps, progress)
    } catch (error) {
      progress.failed += 1
      progress.completed += 1
      results.push({
        contentHash: doc.contentHash,
        outcome: 'failed',
        error: error instanceof Error ? error.message : String(error),
      })
      emit(deps, progress)
    }
  }

  progress.phase = 'done'
  progress.currentHash = undefined
  emit(deps, progress)

  return {
    total: progress.total,
    restored: results.filter((r) => r.outcome === 'restored').length,
    skipped: results.filter((r) => r.outcome === 'skipped_exists').length,
    failed: results.filter((r) => r.outcome === 'failed').length,
    results,
  }
}

function resolveOrganizeDate(doc: MediaDecisionDocument): Date {
  const raw = doc.organizeDate ?? doc.decidedAt
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid organizeDate for ${doc.contentHash}`)
  }
  return date
}

async function resolveUniqueDestination(
  workingRoot: string,
  organizeDate: Date,
  originalFilename: string,
  nameDisambiguator: string,
): Promise<string> {
  for (let attempt = 0; attempt < 1000; attempt += 1) {
    const candidate = destinationFilePath(
      workingRoot,
      'preserve',
      organizeDate,
      originalFilename,
      nameDisambiguator,
      attempt,
    )
    if (!(await pathExists(candidate))) {
      return candidate
    }
  }
  throw new Error('Unable to resolve a unique preserve destination')
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK)
    return true
  } catch {
    return false
  }
}

function emit(deps: RestoreDeps, progress: RestoreProgress): void {
  deps.onProgress?.({ ...progress })
}
