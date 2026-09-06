import { stat } from 'node:fs/promises'
import { captureDateFromStats } from '../workingFolder/filesystemCaptureDate'
import { extractExifFields } from './extractExif'

export type OrganizeDateSource = 'user_override' | 'exif' | 'filesystem'

export type OrganizeDateResult = {
  date: Date
  source: OrganizeDateSource
}

/**
 * Resolve organize/event date for YYYY/MM:
 * user override → EXIF capture date → oldest usable filesystem timestamp.
 */
export async function resolveOrganizeDate(
  sourcePath: string,
  userOverride?: Date,
): Promise<OrganizeDateResult> {
  if (userOverride) {
    if (Number.isNaN(userOverride.getTime())) {
      throw new Error('userOverride must be a valid Date')
    }
    return { date: userOverride, source: 'user_override' }
  }

  const exif = await extractExifFields(sourcePath)
  if (exif.captureDate) {
    return { date: exif.captureDate, source: 'exif' }
  }

  const fileStat = await stat(sourcePath)
  return { date: captureDateFromStats(fileStat), source: 'filesystem' }
}
