import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'

export type ContentHashResult = {
  contentHash: string
  fileSize: number
}

/** SHA-256 of full file bytes, paired with file size. */
export async function hashFileContent(sourcePath: string): Promise<ContentHashResult> {
  const fileStat = await stat(sourcePath)
  if (!fileStat.isFile()) {
    throw new Error(`Source path is not a file: ${sourcePath}`)
  }

  const digest = await new Promise<string>((resolve, reject) => {
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

  return {
    contentHash: digest,
    fileSize: fileStat.size,
  }
}
