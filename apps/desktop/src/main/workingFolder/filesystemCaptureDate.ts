import { stat, type Stats } from 'node:fs/promises'

function isUsableDate(value: Date): boolean {
  const time = value.getTime()
  // Ignore invalid and epoch/placeholder timestamps (common when birthtime is unsupported).
  return !Number.isNaN(time) && time > 0
}

/**
 * Collect usable filesystem timestamps from a file.
 * Until EXIF (Milestone 3), these are the capture-date candidates.
 */
export function filesystemTimestamps(stats: Stats): Date[] {
  return [stats.mtime, stats.birthtime, stats.ctime, stats.atime].filter(isUsableDate)
}

/**
 * Filesystem capture-date fallback when EXIF is unavailable.
 * Uses the **oldest** usable timestamp among modified, created (birthtime),
 * ctime, and atime so organization prefers the earliest evidence on the file.
 */
export function captureDateFromStats(stats: Stats): Date {
  const timestamps = filesystemTimestamps(stats)
  if (timestamps.length === 0) {
    throw new Error('No usable filesystem date on source file')
  }

  return timestamps.reduce((oldest, current) =>
    current.getTime() < oldest.getTime() ? current : oldest,
  )
}

export async function resolveFilesystemCaptureDate(sourcePath: string): Promise<Date> {
  const stats = await stat(sourcePath)
  return captureDateFromStats(stats)
}
