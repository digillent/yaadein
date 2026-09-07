import { readdir, stat } from 'node:fs/promises'
import { basename, relative, resolve } from 'node:path'
import type { MediaDecisionDocument } from '../../shared/decisionTypes'
import type { CherishListResult, CherishMediaEntry } from '../../shared/cherishTypes'
import { hashFileContent } from '../media/hashFile'
import { isMediaPath } from '../media/mediaType'
import { bucketDirectory } from '../workingFolder/paths'
import { yearMonthFromCleanupRelativePath } from '../workingFolder/yearMonthPath'
import { emptyMediaTags } from '../../shared/tagFilter'

export type CherishListDecisions = {
  listAcceptedSynced(): Promise<MediaDecisionDocument[]>
}

export type CherishListDeps = {
  decisions?: CherishListDecisions | null
  hashFile?: typeof hashFileContent
}

/**
 * List local preserve/ keepers; enrich tags from Cosms ACCEPTED+SYNCED when available.
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
  const hashFile = deps.hashFile ?? hashFileContent

  let byHash = new Map<string, MediaDecisionDocument>()
  let tagsFromCosmos = false
  if (deps.decisions) {
    const docs = await deps.decisions.listAcceptedSynced()
    byHash = new Map(docs.map((doc) => [doc.contentHash, doc]))
    tagsFromCosmos = true
  }

  const files: CherishMediaEntry[] = []
  await walkFiles(preserveRoot, async (absolutePath) => {
    try {
      if (!isMediaPath(absolutePath)) {
        return
      }
      const fileStat = await stat(absolutePath)
      if (!fileStat.isFile()) {
        return
      }
      const hashed = await hashFile(absolutePath)
      const doc = byHash.get(hashed.contentHash)
      const relativePath = relative(preserveRoot, absolutePath)
      files.push({
        absolutePath,
        relativePath,
        contentHash: hashed.contentHash,
        fileSize: hashed.fileSize,
        yearMonth: yearMonthFromCleanupRelativePath(relativePath),
        tags: doc?.tags ?? emptyMediaTags(),
        hasCosmosAccepted: Boolean(doc),
        originalFilename: doc?.originalFilename?.trim() || basename(absolutePath),
      })
    } catch {
      // skip unreadable
    }
  })

  files.sort((a, b) => a.relativePath.localeCompare(b.relativePath))
  return { workingRoot: root, files, tagsFromCosmos }
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
