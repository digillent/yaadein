import { readFile, stat } from 'node:fs/promises'
import { isLikelyImagePath, isLikelyVideoPath, mediaTypeFromPath } from '../media/mediaType'
import type { MediaPreview } from '../../shared/reviewTypes'
import { buildMediaStreamUrl } from './mediaStreamProtocol'

const MAX_INLINE_IMAGE_BYTES = 8 * 1024 * 1024

/** Build preview metadata: stream URL for img/video; optional data URL for small images. */
export async function buildMediaPreview(sourcePath: string): Promise<MediaPreview> {
  const mediaType = mediaTypeFromPath(sourcePath)

  if (isLikelyVideoPath(sourcePath)) {
    return {
      sourcePath,
      mediaType,
      kind: 'video',
      streamUrl: buildMediaStreamUrl(sourcePath),
      dataUrl: null,
    }
  }

  if (isLikelyImagePath(sourcePath)) {
    const streamUrl = buildMediaStreamUrl(sourcePath)
    const size = (await stat(sourcePath)).size
    if (size > MAX_INLINE_IMAGE_BYTES) {
      return { sourcePath, mediaType, kind: 'image', streamUrl, dataUrl: null }
    }
    const bytes = await readFile(sourcePath)
    return {
      sourcePath,
      mediaType,
      kind: 'image',
      streamUrl,
      dataUrl: `data:${mediaType};base64,${bytes.toString('base64')}`,
    }
  }

  return { sourcePath, mediaType, kind: 'unsupported', streamUrl: null, dataUrl: null }
}
