import { readdir, stat } from 'node:fs/promises'
import { basename, relative, resolve } from 'node:path'
import type { MediaDecisionDocument } from '../../shared/decisionTypes'
import type { CherishListResult, CherishMediaEntry } from '../../shared/cherishTypes'
import { hashFileContentCached } from '../media/hashFile'
import { isMediaPath } from '../media/mediaType'
import { bucketDirectory } from '../workingFolder/paths'
import { yearMonthFromCleanupRelativePath } from '../workingFolder/yearMonthPath'
import { emptyMediaTags } from '../../shared/tagFilter'

const HASH_CONCURRENCY = 8

export type CherishListDecisions = {
  listAcceptedSynced(): Promise<MediaDecisionDocument[]>
}

export type CherishListDeps = {
  decisions?: CherishListDecisions | null
  hashFile?: (sourcePath: string) => Promise<{ contentHash: string; fileSize: number }>
}

type ListedFile = Omit<CherishMediaEntry, 'localCopyCount' | 'extraLocalPaths'>

/**
 * One tile per contentHash. Prefer Cosms-linked path, then stable relativePath order.
 */
export function dedupeCherishByContentHash(files: ListedFile[]): CherishMediaEntry[] {
  const byHash = new Map<string, ListedFile[]>()
  for (const file of files) {
    const group = byHash.get(file.contentHash)
    if (group) {
      group.push(file)
    } else {
      byHash.set(file.contentHash, [file])
    }
  }

  const deduped: CherishMediaEntry[] = []
  for (const group of byHash.values()) {
    const sorted = [...group].sort((a, b) => {
      if (a.hasCosmosAccepted !== b.hasCosmosAccepted) {
        return a.hasCosmosAccepted ? -1 : 1
      }
      return a.relativePath.localeCompare(b.relativePath)
    })
    const keeper = sorted[0]!
    const extras = sorted.slice(1)
    deduped.push({
      ...keeper,
      localCopyCount: group.length,
      extraLocalPaths: extras.map((f) => f.relativePath),
    })
  }

  deduped.sort((a, b) => a.relativePath.localeCompare(b.relativePath))
  return deduped
}

/**
 * List local preserve/ keepers; enrich tags from Cosms ACCEPTED+SYNCED when available.
 * Exact-hash duplicates under preserve/ collapse to one entry (extra paths flagged).
 * Cosms is the tag source of truth — not Redux.
 */
export async function listCherishMedia(
  workingRoot: string,
  deps: CherishListDeps = {},
): Promise<CherishListResult> {
  if (!workingRoot.trim()) {
    throw new Error('workingRoot is required')
  }
  const root = resolve(workingRoot)
  const preserveRoot = bucketDirectory(root, 'preserve')
  const cosmosPromise: Promise<MediaDecisionDocument[] | null> = deps.decisions
    ? deps.decisions.listAcceptedSynced()
    : Promise.resolve(null)

  const mediaPaths: string[] = []
  await walkFiles(preserveRoot, async (absolutePath) => {
    if (isMediaPath(absolutePath)) {
      mediaPaths.push(absolutePath)
    }
  })

  const listedParts = await mapPool(mediaPaths, HASH_CONCURRENCY, async (absolutePath) => {
    try {
      const fileStat = await stat(absolutePath)
      if (!fileStat.isFile()) {
        return null
      }
      const hashed = deps.hashFile
        ? await deps.hashFile(absolutePath)
        : await hashFileContentCached(absolutePath, fileStat)
      const relativePath = relative(preserveRoot, absolutePath)
      return {
        absolutePath,
        relativePath,
        contentHash: hashed.contentHash,
        fileSize: hashed.fileSize,
        yearMonth: yearMonthFromCleanupRelativePath(relativePath),
        originalFilename: basename(absolutePath),
      }
    } catch {
      return null
    }
  })

  const docs = await cosmosPromise
  const byHash = new Map((docs ?? []).map((doc) => [doc.contentHash, doc]))
  const tagsFromCosmos = docs !== null

  const listed: ListedFile[] = []
  for (const part of listedParts) {
    if (!part) {
      continue
    }
    const doc = byHash.get(part.contentHash)
    listed.push({
      absolutePath: part.absolutePath,
      relativePath: part.relativePath,
      contentHash: part.contentHash,
      fileSize: part.fileSize,
      yearMonth: part.yearMonth,
      tags: doc?.tags ?? emptyMediaTags(),
      hasCosmosAccepted: Boolean(doc),
      originalFilename: doc?.originalFilename?.trim() || part.originalFilename,
    })
  }

  return {
    workingRoot: root,
    files: dedupeCherishByContentHash(listed),
    tagsFromCosmos,
  }
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) {
    return []
  }
  const results: R[] = new Array(items.length)
  let nextIndex = 0
  async function worker(): Promise<void> {
    for (;;) {
      const index = nextIndex
      nextIndex += 1
      if (index >= items.length) {
        return
      }
      results[index] = await fn(items[index]!)
    }
  }
  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker(),
  )
  await Promise.all(workers)
  return results
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
