import { readFile } from 'node:fs/promises'
import { isLikelyImagePath, mediaTypeFromPath } from '../media/mediaType'
import type { MediaPreview } from '../../shared/reviewTypes'

const MAX_PREVIEW_BYTES = 8 * 1024 * 1024

/** Build a data-URL preview for images (CSP-safe). Non-images return dataUrl null. */
export async function buildMediaPreview(sourcePath: string): Promise<MediaPreview> {
  const mediaType = mediaTypeFromPath(sourcePath)
  if (!isLikelyImagePath(sourcePath)) {
    return { sourcePath, mediaType, dataUrl: null }
  }

  const bytes = await readFile(sourcePath)
  if (bytes.byteLength > MAX_PREVIEW_BYTES) {
    return { sourcePath, mediaType, dataUrl: null }
  }

  return {
    sourcePath,
    mediaType,
    dataUrl: `data:${mediaType};base64,${bytes.toString('base64')}`,
  }
}
