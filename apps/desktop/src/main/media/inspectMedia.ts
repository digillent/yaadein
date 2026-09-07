import { basename } from 'node:path'
import { hashFileContent } from './hashFile'
import { isMediaPath, mediaTypeFromPath } from './mediaType'
import { extractExifFields } from './extractExif'
import { resolveOrganizeDate } from './resolveOrganizeDate'
import type { MediaInspection } from './types'

export type InspectMediaOptions = {
  /** User event/organize date override. */
  userOverrideDate?: Date
}

/** Hash + metadata + tags for a single media file (Milestone 3). */
export async function inspectMediaFile(
  sourcePath: string,
  options: InspectMediaOptions = {},
): Promise<MediaInspection> {
  if (!isMediaPath(sourcePath)) {
    throw new Error('Only previewable media files can be inspected or reviewed.')
  }

  const [{ contentHash, fileSize }, exif, organize] = await Promise.all([
    hashFileContent(sourcePath),
    extractExifFields(sourcePath),
    resolveOrganizeDate(sourcePath, options.userOverrideDate),
  ])

  return {
    sourcePath,
    contentHash,
    fileSize,
    mediaType: mediaTypeFromPath(sourcePath),
    captureDate: exif.captureDate ? exif.captureDate.toISOString() : null,
    organizeDate: organize.date.toISOString(),
    organizeDateSource: organize.source,
    width: exif.width,
    height: exif.height,
    duration: null,
    tags: exif.tags,
    originalFilename: basename(sourcePath),
  }
}
