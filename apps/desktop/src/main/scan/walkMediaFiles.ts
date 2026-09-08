import { readdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { isMediaPath } from '../media/mediaType'
import { isPathInsideRoot } from '../workingFolder/cleanupLocal'

const WORKING_BUCKET_DIR_NAMES = new Set(['preserve', 'duplicate', 'rejected'])

export type WalkMediaOptions = {
  /** Configured Yaadein working folder. Bucket dirs are skipped only under this path. */
  workingRoot?: string
}

/**
 * Recursively list media files under scan roots.
 *
 * Walks every subfolder of the scan root (including names like rejected/,
 * duplicate/, preserve/, vacation/, …).
 *
 * The only exception: do not descend into preserve/ | duplicate/ | rejected/
 * when those directories are under the configured working folder — so a scan
 * never re-ingests the organized working tree. A scan folder that merely
 * happens to contain folders with those names is fully scanned.
 */
export async function walkMediaFiles(
  roots: string[],
  options: WalkMediaOptions = {},
): Promise<string[]> {
  const found: string[] = []
  const seen = new Set<string>()
  const workingRoot = options.workingRoot?.trim()
    ? resolve(options.workingRoot.trim())
    : null

  for (const root of roots) {
    const trimmed = root.trim()
    if (!trimmed) {
      continue
    }
    await walkDir(resolve(trimmed), found, seen, workingRoot)
  }

  found.sort()
  return found
}

function isWorkingFolderBucketDir(absolutePath: string, dirName: string, workingRoot: string | null): boolean {
  if (!workingRoot || !WORKING_BUCKET_DIR_NAMES.has(dirName)) {
    return false
  }
  return isPathInsideRoot(workingRoot, absolutePath)
}

async function walkDir(
  dir: string,
  found: string[],
  seen: Set<string>,
  workingRoot: string | null,
): Promise<void> {
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch (error) {
    throw new Error(
      `Unable to read scan root ${dir}: ${error instanceof Error ? error.message : String(error)}`,
    )
  }

  for (const entry of entries) {
    if (entry.name === '.' || entry.name === '..') {
      continue
    }

    const fullPath = join(dir, entry.name)
    if (entry.isDirectory() && isWorkingFolderBucketDir(fullPath, entry.name, workingRoot)) {
      continue
    }

    if (entry.isDirectory()) {
      await walkDir(fullPath, found, seen, workingRoot)
      continue
    }
    if (!entry.isFile() || !isMediaPath(fullPath)) {
      continue
    }
    if (seen.has(fullPath)) {
      continue
    }
    seen.add(fullPath)
    found.push(fullPath)
  }
}
