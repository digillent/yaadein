import type { CloudDecision, CloudStatus } from '../../shared/decisionTypes'

export type SizedMediaFile = {
  sourcePath: string
  fileSize: number
}

export type HashedMediaFile = SizedMediaFile & {
  contentHash: string
}

/**
 * Group files by byte size. Only sizes with 2+ files are peer-duplicate candidates.
 * Size alone never classifies a duplicate — SHA-256 must still match.
 */
export function groupByFileSize(files: SizedMediaFile[]): Map<number, SizedMediaFile[]> {
  const groups = new Map<number, SizedMediaFile[]>()
  for (const file of files) {
    const list = groups.get(file.fileSize)
    if (list) {
      list.push(file)
    } else {
      groups.set(file.fileSize, [file])
    }
  }
  return groups
}

/** Sizes that appear more than once (in-batch peer candidates). */
export function peerCandidateSizes(files: SizedMediaFile[]): Set<number> {
  const sizes = new Set<number>()
  for (const [fileSize, group] of groupByFileSize(files)) {
    if (group.length > 1) {
      sizes.add(fileSize)
    }
  }
  return sizes
}

export type ExactDuplicateClass =
  | { kind: 'rejected' }
  | { kind: 'duplicate'; reason: 'cosmos_accepted' | 'scan_peer' }
  | { kind: 'unknown' }

/**
 * Classify one hashed file given Cosms decision (if any) and hashes already
 * seen earlier in this scan. Never emits a Cosms DUPLICATE write — callers
 * only move locally.
 *
 * Cosms ACCEPTED only counts as a keeper duplicate when cloudStatus is SYNCED
 * (Blob upload succeeded). ACCEPTED+FAILED/PENDING stays reviewable unknown.
 */
export function classifyExactDuplicate(args: {
  contentHash: string
  cosmosDecision: CloudDecision | undefined
  cosmosCloudStatus?: CloudStatus | null
  /** Hashes already encountered earlier in this scan (keeper or moved). */
  seenHashes: ReadonlySet<string>
}): ExactDuplicateClass {
  if (args.cosmosDecision === 'REJECTED') {
    return { kind: 'rejected' }
  }
  if (args.cosmosDecision === 'ACCEPTED' && args.cosmosCloudStatus === 'SYNCED') {
    return { kind: 'duplicate', reason: 'cosmos_accepted' }
  }
  if (args.seenHashes.has(args.contentHash)) {
    return { kind: 'duplicate', reason: 'scan_peer' }
  }
  return { kind: 'unknown' }
}
