import { copyFile, mkdir, rename, stat, unlink, access } from 'node:fs/promises'
import { constants } from 'node:fs'
import { basename } from 'node:path'
import type { MoveMediaInput, MoveMediaResult } from './types'
import { destinationDirectory, destinationFilePath, formatYearMonth } from './paths'
import { ensureWorkingFolder } from './ensureTree'
import { resolveOrganizeDate } from '../media/resolveOrganizeDate'

type ResolvedMoveInput = MoveMediaInput & { captureDate: Date }

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK)
    return true
  } catch {
    return false
  }
}

async function resolveUniqueDestinationPath(input: ResolvedMoveInput): Promise<string> {
  const originalFilename = basename(input.sourcePath)

  for (let attempt = 0; attempt < 1000; attempt += 1) {
    const candidate = destinationFilePath(
      input.workingRoot,
      input.bucket,
      input.captureDate,
      originalFilename,
      input.nameDisambiguator,
      attempt,
    )

    if (!(await pathExists(candidate))) {
      return candidate
    }
  }

  throw new Error('Unable to resolve a unique destination file name')
}

async function sameFilesystem(sourcePath: string, destinationDir: string): Promise<boolean> {
  const [sourceStat, destStat] = await Promise.all([stat(sourcePath), stat(destinationDir)])
  return sourceStat.dev === destStat.dev
}

/**
 * Move a media file into the working folder.
 * Same volume: rename. Cross-volume: copy, verify size, then delete source.
 * YYYY/MM uses `captureDate` when provided (user override); otherwise EXIF
 * capture date, else the oldest usable filesystem timestamp.
 */
export async function moveMediaIntoWorkingFolder(
  input: MoveMediaInput,
): Promise<MoveMediaResult> {
  if (!(await pathExists(input.sourcePath))) {
    throw new Error(`Source file does not exist: ${input.sourcePath}`)
  }

  const sourceStat = await stat(input.sourcePath)
  if (!sourceStat.isFile()) {
    throw new Error(`Source path is not a file: ${input.sourcePath}`)
  }

  const captureDate = input.captureDate
    ? input.captureDate
    : (await resolveOrganizeDate(input.sourcePath)).date
  if (Number.isNaN(captureDate.getTime())) {
    throw new Error('captureDate must be a valid Date')
  }

  const resolved: ResolvedMoveInput = { ...input, captureDate }

  await ensureWorkingFolder(input.workingRoot)

  const destDir = destinationDirectory(input.workingRoot, input.bucket, captureDate)
  await mkdir(destDir, { recursive: true })

  const destinationPath = await resolveUniqueDestinationPath(resolved)

  if (await sameFilesystem(input.sourcePath, destDir)) {
    await rename(input.sourcePath, destinationPath)
  } else {
    await copyFile(input.sourcePath, destinationPath)
    const copiedStat = await stat(destinationPath)
    if (copiedStat.size !== sourceStat.size) {
      await unlink(destinationPath).catch(() => undefined)
      throw new Error('Cross-volume copy failed size verification')
    }
    await unlink(input.sourcePath)
  }

  if (!(await pathExists(destinationPath))) {
    throw new Error(`Move failed; destination missing: ${destinationPath}`)
  }

  if (await pathExists(input.sourcePath)) {
    throw new Error(`Move failed; source still present: ${input.sourcePath}`)
  }

  return {
    destinationPath,
    bucket: input.bucket,
    yearMonth: formatYearMonth(captureDate),
  }
}
