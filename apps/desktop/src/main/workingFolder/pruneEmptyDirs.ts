import { readdir, rmdir, stat, unlink } from 'node:fs/promises'
import type { Dirent } from 'node:fs'
import { dirname, relative, resolve, sep } from 'node:path'

/** Filenames that do not keep a folder "in use" after media has been moved out. */
const JUNK_FILE_NAMES = new Set([
  '.ds_store',
  'thumbs.db',
  'desktop.ini',
  '.localized',
])

export function isJunkFileName(name: string): boolean {
  return JUNK_FILE_NAMES.has(name.toLowerCase())
}

function isStrictlyInsideRoot(root: string, candidate: string): boolean {
  const resolvedRoot = resolve(root)
  const resolvedCandidate = resolve(candidate)
  if (resolvedCandidate === resolvedRoot) {
    return false
  }
  const rel = relative(resolvedRoot, resolvedCandidate)
  return rel !== '' && !rel.startsWith('..') && !rel.startsWith(`..${sep}`)
}

type EntryKind = 'dir' | 'junk' | 'keep'

/**
 * Classify a dirent. When the filesystem returns DT_UNKNOWN, isFile()/isDirectory()
 * are both false — fall back to stat so .DS_Store is still treated as junk.
 */
async function classifyEntry(parentDir: string, entry: Dirent): Promise<EntryKind> {
  if (entry.isDirectory()) {
    return 'dir'
  }
  if (entry.isFile() || entry.isSymbolicLink()) {
    return isJunkFileName(entry.name) ? 'junk' : 'keep'
  }

  try {
    const fileStat = await stat(resolve(parentDir, entry.name))
    if (fileStat.isDirectory()) {
      return 'dir'
    }
    if (fileStat.isFile() && isJunkFileName(entry.name)) {
      return 'junk'
    }
  } catch {
    // treat as keeper if unreadable
  }
  return isJunkFileName(entry.name) ? 'junk' : 'keep'
}

/**
 * Delete dir when it is empty or only contains junk system files (.DS_Store, etc.).
 * Returns true when the directory was removed.
 */
export async function removeDirIfEmptyOrJunkOnly(dir: string): Promise<boolean> {
  const absolute = resolve(dir)
  let entries: Dirent[]
  try {
    entries = await readdir(absolute, { withFileTypes: true })
  } catch {
    return false
  }

  const junkNames: string[] = []
  for (const entry of entries) {
    const kind = await classifyEntry(absolute, entry)
    if (kind === 'keep' || kind === 'dir') {
      return false
    }
    junkNames.push(entry.name)
  }

  for (const name of junkNames) {
    try {
      await unlink(resolve(absolute, name))
    } catch {
      return false
    }
  }

  try {
    await rmdir(absolute)
    return true
  } catch {
    return false
  }
}

/**
 * Depth-first: prune empty/junk-only children. Optionally remove `root` itself.
 */
export async function pruneEmptyDirTree(
  root: string,
  options: { removeRoot?: boolean } = {},
): Promise<void> {
  const absolute = resolve(root)
  let entries: Dirent[]
  try {
    entries = await readdir(absolute, { withFileTypes: true })
  } catch {
    return
  }

  for (const entry of entries) {
    const kind = await classifyEntry(absolute, entry)
    if (kind === 'dir') {
      await pruneEmptyDirTree(resolve(absolute, entry.name), { removeRoot: true })
    }
  }

  if (options.removeRoot) {
    await removeDirIfEmptyOrJunkOnly(absolute)
    return
  }

  // Strip junk at the protected root when nothing else remains.
  try {
    entries = await readdir(absolute, { withFileTypes: true })
    const kinds = await Promise.all(entries.map((entry) => classifyEntry(absolute, entry)))
    if (kinds.length > 0 && kinds.every((kind) => kind === 'junk')) {
      for (const entry of entries) {
        await unlink(resolve(absolute, entry.name)).catch(() => undefined)
      }
    }
  } catch {
    // ignore
  }
}

/**
 * Walk parents upward and remove empty/junk-only dirs that are strictly inside
 * one of `boundaryRoots` (the boundary roots themselves are never deleted).
 */
export async function pruneEmptyAncestors(
  startDir: string,
  boundaryRoots: string[],
): Promise<void> {
  const boundaries = boundaryRoots.map((p) => resolve(p)).filter(Boolean)
  if (boundaries.length === 0) {
    return
  }

  let dir = resolve(startDir)
  while (boundaries.some((boundary) => isStrictlyInsideRoot(boundary, dir))) {
    const parent = dirname(dir)
    if (parent === dir) {
      break
    }
    const removed = await removeDirIfEmptyOrJunkOnly(dir)
    if (!removed) {
      break
    }
    dir = parent
  }
}
