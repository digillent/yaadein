import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { stat, type Stats } from 'node:fs/promises'

export type ContentHashResult = {
  contentHash: string
  fileSize: number
}

type HashCacheEntry = {
  mtimeMs: number
  size: number
  contentHash: string
}

const hashCache = new Map<string, HashCacheEntry>()

/** Clear process-local hash cache (tests). */
export function clearHashFileCache(): void {
  hashCache.clear()
}

async function hashFileBytes(sourcePath: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const hash = createHash('sha256')
    createReadStream(sourcePath)
      .on('data', (chunk: Buffer | string) => {
        hash.update(chunk)
      })
      .on('error', reject)
      .on('end', () => {
        resolve(hash.digest('hex'))
      })
  })
}

/** SHA-256 of full file bytes, paired with file size. */
export async function hashFileContent(sourcePath: string): Promise<ContentHashResult> {
  const fileStat = await stat(sourcePath)
  if (!fileStat.isFile()) {
    throw new Error(`Source path is not a file: ${sourcePath}`)
  }

  const digest = await hashFileBytes(sourcePath)
  return {
    contentHash: digest,
    fileSize: fileStat.size,
  }
}

/**
 * Same as hashFileContent, but skips re-reading when path+mtimeMs+size match a
 * process-local cache (View media / refresh of thousands of files).
 */
export async function hashFileContentCached(
  sourcePath: string,
  knownStat?: Stats,
): Promise<ContentHashResult> {
  const fileStat = knownStat ?? (await stat(sourcePath))
  if (!fileStat.isFile()) {
    throw new Error(`Source path is not a file: ${sourcePath}`)
  }

  const cached = hashCache.get(sourcePath)
  if (
    cached &&
    cached.mtimeMs === fileStat.mtimeMs &&
    cached.size === fileStat.size
  ) {
    return { contentHash: cached.contentHash, fileSize: fileStat.size }
  }

  const contentHash = await hashFileBytes(sourcePath)
  hashCache.set(sourcePath, {
    mtimeMs: fileStat.mtimeMs,
    size: fileStat.size,
    contentHash,
  })
  return { contentHash, fileSize: fileStat.size }
}
