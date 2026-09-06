import { mkdir } from 'node:fs/promises'
import { WORKING_BUCKETS } from './types'
import { bucketDirectory } from './paths'

/** Ensure `{root}/preserve|duplicate|rejected` exist. */
export async function ensureWorkingFolder(workingRoot: string): Promise<void> {
  if (!workingRoot.trim()) {
    throw new Error('workingRoot is required')
  }

  await mkdir(workingRoot, { recursive: true })

  for (const bucket of WORKING_BUCKETS) {
    await mkdir(bucketDirectory(workingRoot, bucket), { recursive: true })
  }
}
