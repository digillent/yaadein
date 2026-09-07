import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { isMediaPath } from '../media/mediaType'

/**
 * Recursively list media files under one or more roots.
 * Skips directories named preserve / duplicate / rejected (working-folder buckets).
 */
export async function walkMediaFiles(roots: string[]): Promise<string[]> {
  const found: string[] = []
  const seen = new Set<string>()

  for (const root of roots) {
    const trimmed = root.trim()
    if (!trimmed) {
      continue
    }
    await walkDir(trimmed, found, seen)
  }

  found.sort()
  return found
}

async function walkDir(dir: string, found: string[], seen: Set<string>): Promise<void> {
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
    // Avoid re-scanning organized working-folder trees.
    if (
      entry.isDirectory() &&
      (entry.name === 'preserve' || entry.name === 'duplicate' || entry.name === 'rejected')
    ) {
      continue
    }

    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      await walkDir(fullPath, found, seen)
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
