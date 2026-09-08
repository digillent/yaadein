import { readdir, stat, unlink } from 'node:fs/promises'
import { relative, resolve, sep } from 'node:path'
import { isMediaPath } from '../media/mediaType'
import { bucketDirectory } from './paths'
import { yearMonthFromCleanupRelativePath } from './yearMonthPath'
import { pruneEmptyDirTree } from './pruneEmptyDirs'
import type { CleanupBucket, CleanupFileEntry, CleanupListResult } from '../../shared/cleanupTypes'
import { CLEANUP_BUCKETS } from '../../shared/cleanupTypes'

export function assertCleanupBucket(value: string): asserts value is CleanupBucket {
  if (!(CLEANUP_BUCKETS as readonly string[]).includes(value)) {
    throw new Error('Cleanup is only allowed for rejected/ or duplicate/ — never preserve/.')
  }
}

/** True when candidate is inside root (after resolve). */
export function isPathInsideRoot(root: string, candidate: string): boolean {
  const resolvedRoot = resolve(root)
  const resolvedCandidate = resolve(candidate)
  if (resolvedCandidate === resolvedRoot) {
    return true
  }
  const rel = relative(resolvedRoot, resolvedCandidate)
  return rel !== '' && !rel.startsWith('..') && !rel.startsWith(`..${sep}`)
}

/**
 * List media files under workingRoot/{rejected|duplicate}.
 * Does not touch Cosms — local cleanup only.
 */
export async function listCleanupFiles(
  workingRoot: string,
  bucket: CleanupBucket,
): Promise<CleanupListResult> {
  assertCleanupBucket(bucket)
  if (!workingRoot.trim()) {
    throw new Error('workingRoot is required')
  }

  const root = resolve(workingRoot)
  const bucketRoot = bucketDirectory(root, bucket)
  const files: CleanupFileEntry[] = []

  await walkFiles(bucketRoot, async (absolutePath) => {
    if (!isPathInsideRoot(bucketRoot, absolutePath)) {
      return
    }
    if (!isMediaPath(absolutePath)) {
      return
    }
    const fileStat = await stat(absolutePath)
    if (!fileStat.isFile()) {
      return
    }
    files.push({
      absolutePath,
      relativePath: relative(bucketRoot, absolutePath),
      sizeBytes: fileStat.size,
      yearMonth: yearMonthFromCleanupRelativePath(relative(bucketRoot, absolutePath)),
    })
  })

  files.sort((a, b) => a.relativePath.localeCompare(b.relativePath))
  const totalBytes = files.reduce((sum, f) => sum + f.sizeBytes, 0)
  return { workingRoot: root, bucket, files, totalBytes }
}

/**
 * Permanently delete confirmed files under rejected/ or duplicate/ only.
 * Refuses paths outside the bucket. Does not call Cosms.
 */
export async function deleteCleanupFiles(
  workingRoot: string,
  bucket: CleanupBucket,
  absolutePaths: string[],
): Promise<{ deleted: string[]; failed: Array<{ path: string; error: string }> }> {
  assertCleanupBucket(bucket)
  if (!workingRoot.trim()) {
    throw new Error('workingRoot is required')
  }

  const root = resolve(workingRoot)
  const bucketRoot = bucketDirectory(root, bucket)
  const deleted: string[] = []
  const failed: Array<{ path: string; error: string }> = []

  for (const rawPath of absolutePaths) {
    const absolutePath = resolve(rawPath)
    try {
      if (!isPathInsideRoot(bucketRoot, absolutePath)) {
        throw new Error('Refusing to delete path outside cleanup bucket.')
      }
      if (!isMediaPath(absolutePath)) {
        throw new Error('Cleanup only allows previewable media files.')
      }
      if (isPathInsideRoot(bucketDirectory(root, 'preserve'), absolutePath)) {
        throw new Error('Refusing to delete under preserve/.')
      }
      const fileStat = await stat(absolutePath)
      if (!fileStat.isFile()) {
        throw new Error('Path is not a file.')
      }
      await unlink(absolutePath)
      deleted.push(absolutePath)
    } catch (error) {
      failed.push({
        path: absolutePath,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  await pruneEmptyDirTree(bucketRoot, { removeRoot: false })
  return { deleted, failed }
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
