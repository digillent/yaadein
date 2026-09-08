import type { MediaPreview } from './reviewTypes'
import {
  isLikelyImagePath,
  isLikelyVideoPath,
  mediaTypeFromPath,
} from './mediaPath'
import { buildMediaStreamUrl } from './mediaStreamUrl'

/**
 * Sync preview metadata for local paths (stream URL only — no base64 / IPC).
 * Safe to call from the renderer on every nav or grid card.
 */
export function buildLocalMediaPreview(sourcePath: string): MediaPreview {
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
    return {
      sourcePath,
      mediaType,
      kind: 'image',
      streamUrl: buildMediaStreamUrl(sourcePath),
      dataUrl: null,
    }
  }

  return { sourcePath, mediaType, kind: 'unsupported', streamUrl: null, dataUrl: null }
}
