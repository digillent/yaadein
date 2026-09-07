import { readdir, mkdir, rename, unlink, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import type { MediaDecisionDocument } from '../../shared/decisionTypes'
import type { DuplicateComparePair } from '../../shared/duplicateTypes'
import { buildCloudObjectId } from '../blob/blobConfig'
import type { BlobMediaStore } from '../blob/blobUploader'
import { hashFileContent } from '../media/hashFile'
import { bucketDirectory, destinationDirectory, destinationFilePath } from '../workingFolder/paths'
import { ensureWorkingFolder } from '../workingFolder/ensureTree'
import { isPathInsideRoot } from '../workingFolder/cleanupLocal'

export type DuplicateResolveDecisions = {
  lookupByHashes(hashes: string[]): Promise<MediaDecisionDocument[]>
  requireUserId(): string
}

export type DuplicateResolveDeps = {
  decisions: DuplicateResolveDecisions
  blobs: BlobMediaStore
  hashFile?: typeof hashFileContent
  /** When true, download Blob into preserve/ if no local original (default true). */
  downloadIfMissing?: boolean
}

/**
 * Resolve Cosms ACCEPTED original for a file under duplicate/: local preserve/ match,
 * or Blob download into preserve/ when SYNCED and missing locally.
 */
export async function resolveDuplicateComparePair(
  workingRoot: string,
  duplicatePath: string,
  deps: DuplicateResolveDeps,
): Promise<DuplicateComparePair> {
  if (!workingRoot.trim()) {
    throw new Error('workingRoot is required')
  }
  const root = resolve(workingRoot)
  const dupAbs = resolve(duplicatePath)
  const duplicateRoot = bucketDirectory(root, 'duplicate')
  if (!isPathInsideRoot(duplicateRoot, dupAbs)) {
    throw new Error('Compare requires the file to be under duplicate/.')
  }
  if (!existsSync(dupAbs)) {
    throw new Error(`Duplicate file not found: ${dupAbs}`)
  }

  const hashFile = deps.hashFile ?? hashFileContent
  const hashed = await hashFile(dupAbs)
  const relativePath = relative(duplicateRoot, dupAbs)

  const docs = await deps.decisions.lookupByHashes([hashed.contentHash])
  const accepted = docs.find((d) => d.decision === 'ACCEPTED') ?? null

  if (!accepted) {
    return {
      duplicatePath: dupAbs,
      duplicateRelativePath: relativePath,
      contentHash: hashed.contentHash,
      fileSize: hashed.fileSize,
      original: {
        status: 'unavailable',
        path: null,
        cloudObjectId: null,
        detail: 'No Cosms ACCEPTED document for this hash (scan-peer only or not yet accepted).',
      },
    }
  }

  const local = await findPreserveFileByHash(
    root,
    hashed.contentHash,
    accepted.fileSize ?? hashed.fileSize,
    hashFile,
  )
  if (local) {
    return {
      duplicatePath: dupAbs,
      duplicateRelativePath: relativePath,
      contentHash: hashed.contentHash,
      fileSize: hashed.fileSize,
      original: {
        status: 'local',
        path: local,
        cloudObjectId: accepted.cloudObjectId ?? null,
        detail: 'Matched local preserve/ by content hash.',
      },
    }
  }

  const userId = deps.decisions.requireUserId()
  const cloudObjectId =
    accepted.cloudObjectId?.trim() || buildCloudObjectId(userId, hashed.contentHash)
  const shouldDownload = deps.downloadIfMissing !== false

  if (!shouldDownload || accepted.cloudStatus !== 'SYNCED') {
    return {
      duplicatePath: dupAbs,
      duplicateRelativePath: relativePath,
      contentHash: hashed.contentHash,
      fileSize: hashed.fileSize,
      original: {
        status: 'unavailable',
        path: null,
        cloudObjectId: accepted.cloudObjectId ?? null,
        detail:
          accepted.cloudStatus !== 'SYNCED'
            ? `Cosms ACCEPTED but cloudStatus is ${accepted.cloudStatus}; cannot download.`
            : 'Original not found under preserve/.',
      },
    }
  }

  await ensureWorkingFolder(root)
  const organizeDate = resolveOrganizeDate(accepted)
  const filename = accepted.originalFilename?.trim() || `${hashed.contentHash}.bin`
  const destDir = destinationDirectory(root, 'preserve', organizeDate)
  await mkdir(destDir, { recursive: true })
  const destPath = destinationFilePath(
    root,
    'preserve',
    organizeDate,
    filename,
    hashed.contentHash.slice(0, 8),
    0,
  )

  const tempPath = `${destPath}.yaadein-download`
  try {
    await deps.blobs.downloadFile({ cloudObjectId, localPath: tempPath })
    const downloaded = await hashFile(tempPath)
    if (downloaded.contentHash !== hashed.contentHash || downloaded.fileSize !== hashed.fileSize) {
      throw new Error('Downloaded original failed hash/size verification.')
    }
    await rename(tempPath, destPath)
  } catch (error) {
    await unlink(tempPath).catch(() => undefined)
    throw error
  }

  return {
    duplicatePath: dupAbs,
    duplicateRelativePath: relativePath,
    contentHash: hashed.contentHash,
    fileSize: hashed.fileSize,
    original: {
      status: 'downloaded',
      path: destPath,
      cloudObjectId,
      detail: 'Downloaded from Blob into preserve/ and verified.',
    },
  }
}

export async function findPreserveFileByHash(
  workingRoot: string,
  contentHash: string,
  fileSize: number,
  hashFile: typeof hashFileContent = hashFileContent,
): Promise<string | null> {
  const preserveRoot = bucketDirectory(resolve(workingRoot), 'preserve')
  const candidates: string[] = []
  await walkFiles(preserveRoot, async (absolutePath) => {
    try {
      const fileStat = await stat(absolutePath)
      if (fileStat.isFile() && fileStat.size === fileSize) {
        candidates.push(absolutePath)
      }
    } catch {
      // skip
    }
  })

  for (const candidate of candidates) {
    const hashed = await hashFile(candidate)
    if (hashed.contentHash === contentHash) {
      return candidate
    }
  }
  return null
}

function resolveOrganizeDate(doc: MediaDecisionDocument): Date {
  const raw = doc.organizeDate ?? doc.captureDate
  if (raw) {
    const parsed = new Date(raw)
    if (!Number.isNaN(parsed.getTime())) {
      return parsed
    }
  }
  return new Date()
}

async function walkFiles(
  dir: string,
  onFile: (absolutePath: string) => Promise<void>,
): Promise<void> {
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === 'ENOENT') {
      return
    }
    throw error
  }
  for (const entry of entries) {
    const full = resolve(dir, entry.name)
    if (entry.isDirectory()) {
      await walkFiles(full, onFile)
    } else if (entry.isFile()) {
      await onFile(full)
    }
  }
}
