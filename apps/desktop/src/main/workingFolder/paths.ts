import { basename, extname, join } from 'node:path'
import type { WorkingBucket } from './types'

export function formatYearMonth(captureDate: Date): string {
  if (Number.isNaN(captureDate.getTime())) {
    throw new Error('captureDate must be a valid Date')
  }

  const year = String(captureDate.getUTCFullYear())
  const month = String(captureDate.getUTCMonth() + 1).padStart(2, '0')
  return `${year}/${month}`
}

export function bucketDirectory(workingRoot: string, bucket: WorkingBucket): string {
  return join(workingRoot, bucket)
}

export function destinationDirectory(
  workingRoot: string,
  bucket: WorkingBucket,
  captureDate: Date,
): string {
  return join(bucketDirectory(workingRoot, bucket), formatYearMonth(captureDate))
}

/** Strip directory components; keep a usable file name. */
export function sanitizeFileName(originalFilename: string): string {
  const name = basename(originalFilename)
  if (!name || name === '.' || name === '..') {
    throw new Error('originalFilename must include a file name')
  }
  return name
}

export function buildCandidateFileName(
  originalFilename: string,
  nameDisambiguator?: string,
  attempt = 0,
): string {
  const safeName = sanitizeFileName(originalFilename)
  const extension = extname(safeName)
  const stem = extension.length > 0 ? safeName.slice(0, -extension.length) : safeName

  if (attempt === 0) {
    return safeName
  }

  if (nameDisambiguator) {
    if (attempt === 1) {
      return `${stem}_${nameDisambiguator}${extension}`
    }
    return `${stem}_${nameDisambiguator}_${attempt - 1}${extension}`
  }

  return `${stem}_${attempt}${extension}`
}

export function destinationFilePath(
  workingRoot: string,
  bucket: WorkingBucket,
  captureDate: Date,
  originalFilename: string,
  nameDisambiguator?: string,
  attempt = 0,
): string {
  return join(
    destinationDirectory(workingRoot, bucket, captureDate),
    buildCandidateFileName(originalFilename, nameDisambiguator, attempt),
  )
}
